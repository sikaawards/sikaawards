const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();
const { FieldValue } = admin.firestore;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
  }

  // Vérifier l'authentification admin
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ ok: false, error: 'Connexion requise.' });

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ ok: false, error: 'Session invalide.' });
  }

  // Vérifier que c'est un admin
  const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
  const userDoc = await admin.auth().getUser(uid);
  if (!ADMIN_EMAILS.includes(userDoc.email)) {
    return res.status(403).json({ ok: false, error: 'Accès refusé. Admin uniquement.' });
  }

  try {
    // 1. Réinitialiser les votes de tous les nominés dans toutes les catégories
    const categoriesSnap = await db.collection('categories').get();
    const batch = db.batch();

    categoriesSnap.forEach(catDoc => {
      const nominees = catDoc.data().nominees || [];
      const updatedNominees = nominees.map(n => ({ ...n, votes: 0 }));
      batch.update(catDoc.ref, { nominees: updatedNominees });
    });

    await batch.commit();

    // 2. Supprimer tous les documents de votes
    const votesSnap = await db.collection('votes').get();
    const deleteBatch = db.batch();
    votesSnap.forEach(doc => deleteBatch.delete(doc.ref));
    if (!votesSnap.empty) await deleteBatch.commit();

    // 3. Supprimer toutes les limites de vote
    const limitsSnap = await db.collection('voteLimits').get();
    const limitsBatch = db.batch();
    limitsSnap.forEach(doc => limitsBatch.delete(doc.ref));
    if (!limitsSnap.empty) await limitsBatch.commit();

    // 4. Réinitialiser voted_categories pour tous les utilisateurs
    const usersSnap = await db.collection('users').get();
    const usersBatch = db.batch();
    usersSnap.forEach(doc => usersBatch.update(doc.ref, { voted_categories: [] }));
    if (!usersSnap.empty) await usersBatch.commit();

    return res.status(200).json({ 
      ok: true, 
      message: `Votes réinitialisés avec succès. ${categoriesSnap.size} catégories, ${votesSnap.size} votes, ${limitsSnap.size} limites, ${usersSnap.size} utilisateurs.` 
    });
  } catch (err) {
    console.error('Erreur réinitialisation votes:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur.' });
  }
};

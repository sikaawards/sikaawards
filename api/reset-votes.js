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

  // Vérifier que c'est un admin en chargeant depuis Firestore
  const adminsSnap = await db.collection('admins').get();
  const ADMIN_EMAILS = [];
  adminsSnap.forEach(doc => {
    const data = doc.data();
    const email = data.email || data.email1 || data.email2 || data.email3 || data.email4;
    if (email) ADMIN_EMAILS.push(email);
  });

  const userDoc = await admin.auth().getUser(uid);
  if (!ADMIN_EMAILS.includes(userDoc.email)) {
    return res.status(403).json({ ok: false, error: 'Accès refusé. Admin uniquement.' });
  }

  try {
    // Réinitialiser UNIQUEMENT les votes des nominés à 0 dans toutes les catégories
    const categoriesSnap = await db.collection('categories').get();
    const batch = db.batch();

    categoriesSnap.forEach(catDoc => {
      const nominees = catDoc.data().nominees || [];
      const updatedNominees = nominees.map(n => ({ ...n, votes: 0 }));
      batch.update(catDoc.ref, { nominees: updatedNominees });
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      message: `Votes réinitialisés avec succès. ${categoriesSnap.size} catégories mises à jour.`
    });
  } catch (err) {
    console.error('Erreur réinitialisation votes:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur.' });
  }
};

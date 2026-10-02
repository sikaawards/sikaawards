const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

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
    // 1. Supprimer les limites de vote
    const limitsSnap = await db.collection('voteLimits').get();
    const batch = db.batch();
    limitsSnap.forEach(doc => batch.delete(doc.ref));

    // 2. Supprimer les documents de votes
    const votesSnap = await db.collection('votes').get();
    votesSnap.forEach(doc => batch.delete(doc.ref));

    // 3. Réinitialiser voted_categories pour tous les utilisateurs
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => batch.update(doc.ref, { voted_categories: [] }));

    if (!limitsSnap.empty || !votesSnap.empty || !usersSnap.empty) {
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      message: `Limites réinitialisées avec succès. ${limitsSnap.size} limites, ${votesSnap.size} votes, ${usersSnap.size} utilisateurs.`
    });
  } catch (err) {
    console.error('Erreur réinitialisation limites:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur.' });
  }
};

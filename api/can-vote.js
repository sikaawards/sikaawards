const crypto = require('crypto');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();

// Mêmes limites que api/vote.js
const MAX_PER_IP = 2;
const MAX_PER_DEVICE = 1;

const hash = (v) =>
  crypto.createHash('sha256').update(`${process.env.VOTE_SALT || ''}${v}`).digest('hex').slice(0, 32);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ canVote: false, reason: 'Méthode non autorisée' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ canVote: false, reason: 'Connexion requise pour voter.' });

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ canVote: false, reason: 'Session invalide, reconnecte-toi.' });
  }

  const { categoryId, deviceId } = req.query || {};
  if (typeof categoryId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(categoryId)) {
    return res.status(400).json({ canVote: false, reason: 'Requête invalide.' });
  }

  const ip = (req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);

  try {
    const reads = [
      db.doc(`votes/${uid}_${categoryId}_${day}`).get(),
      db.doc(`voteLimits/ip_${hash(ip)}_${categoryId}_${day}`).get(),
    ];
    const hasDevice = typeof deviceId === 'string' && deviceId.length > 0 && deviceId.length <= 64;
    if (hasDevice) reads.push(db.doc(`voteLimits/dev_${hash(deviceId)}_${categoryId}_${day}`).get());

    const [vote, ipDoc, devDoc] = await Promise.all(reads);

    if (vote.exists) {
      return res.status(200).json({ canVote: false, reason: 'Tu as déjà voté pour cette catégorie aujourd\'hui, reviens demain.' });
    }
    if ((ipDoc.data()?.count || 0) >= MAX_PER_IP) {
      return res.status(200).json({ canVote: false, reason: 'Limite atteinte pour ta connexion aujourd\'hui.' });
    }
    if (devDoc && (devDoc.data()?.count || 0) >= MAX_PER_DEVICE) {
      return res.status(200).json({ canVote: false, reason: 'Limite atteinte pour ton appareil aujourd\'hui.' });
    }
    return res.status(200).json({ canVote: true });
  } catch (err) {
    console.error('Erreur can-vote:', err);
    return res.status(500).json({ canVote: false, reason: 'Erreur serveur, réessaie.' });
  }
};

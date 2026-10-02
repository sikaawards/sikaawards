const crypto = require('crypto');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const db = admin.firestore();
const { FieldValue } = admin.firestore;

// Limites par catégorie et par jour
const MAX_PER_IP = 2;
const MAX_PER_DEVICE = 1;

class VoteError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const hash = (v) =>
  crypto.createHash('sha256').update(`${process.env.VOTE_SALT || ''}${v}`).digest('hex').slice(0, 32);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });
  }

  // 1. Identité vérifiée côté serveur
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) return res.status(401).json({ ok: false, error: 'Connexion requise pour voter.' });

  let uid;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ ok: false, error: 'Session invalide, reconnecte-toi.' });
  }

  // 2. Validation des entrées
  const { categoryId, winnerName, deviceId } = req.body || {};
  if (typeof categoryId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(categoryId) ||
      typeof winnerName !== 'string' || !winnerName || winnerName.length > 200) {
    return res.status(400).json({ ok: false, error: 'Requête invalide.' });
  }

  const ip = (req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || 'unknown')
    .split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);

  const catRef = db.doc(`categories/${categoryId}`);
  const voteRef = db.doc(`votes/${uid}_${categoryId}_${day}`);
  const ipRef = db.doc(`voteLimits/ip_${hash(ip)}_${categoryId}_${day}`);
  const deviceRef = (typeof deviceId === 'string' && deviceId.length <= 64)
    ? db.doc(`voteLimits/dev_${hash(deviceId)}_${categoryId}_${day}`)
    : null;

  try {
    await db.runTransaction(async (tx) => {
      const [cat, vote, ipDoc, devDoc] = await Promise.all([
        tx.get(catRef),
        tx.get(voteRef),
        tx.get(ipRef),
        deviceRef ? tx.get(deviceRef) : Promise.resolve(null),
      ]);

      if (!cat.exists) throw new VoteError(404, 'Catégorie introuvable.');
      const nominees = cat.data().nominees || [];
      const idx = nominees.findIndex((n) => n.name === winnerName);
      if (idx === -1) throw new VoteError(400, 'Nominé introuvable.');

      if (vote.exists) {
        throw new VoteError(200, 'Tu as déjà voté pour cette catégorie aujourd\'hui, reviens demain.');
      }
      if ((ipDoc.data()?.count || 0) >= MAX_PER_IP) {
        throw new VoteError(200, 'Limite atteinte pour ta connexion aujourd\'hui.');
      }
      if (devDoc && (devDoc.data()?.count || 0) >= MAX_PER_DEVICE) {
        throw new VoteError(200, 'Limite atteinte pour ton appareil aujourd\'hui.');
      }

      nominees[idx] = { ...nominees[idx], votes: (nominees[idx].votes || 0) + 1 };
      tx.update(catRef, { nominees });
      tx.set(voteRef, { uid, categoryId, nominee: winnerName, day, createdAt: FieldValue.serverTimestamp() });
      tx.set(ipRef, { count: FieldValue.increment(1), day }, { merge: true });
      if (deviceRef) tx.set(deviceRef, { count: FieldValue.increment(1), day }, { merge: true });
      tx.set(db.doc(`users/${uid}`), { voted_categories: FieldValue.arrayUnion(categoryId) }, { merge: true });
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof VoteError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    console.error('Erreur vote:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur, réessaie.' });
  }
};

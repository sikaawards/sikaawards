const { db, collection, getDocs, doc, getDoc } = require('../scripts/firebase-config.js');
const { auth } = require('../scripts/firebase-config.js');
const { verifyIdToken } = require('firebase-admin/auth');
const admin = require('firebase-admin');

// Initialiser Firebase Admin pour la vérification des tokens uniquement
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
} catch (error) {
  console.log('Firebase Admin non initialisé, utilisation du SDK client');
}

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier le token Firebase
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decodedToken = await verifyIdToken(token);
    const uid = decodedToken.uid;

    // Charger les emails admin depuis Firestore
    const adminsSnap = await getDocs(collection(db, 'admins'));
    const ADMIN_EMAILS = [];
    adminsSnap.forEach(doc => {
      const data = doc.data();
      const email = data.email || data.email1 || data.email2 || data.email3 || data.email4;
      if (email) ADMIN_EMAILS.push(email);
    });

    // Récupérer l'email de l'utilisateur depuis Firestore
    const userDoc = await getDoc(doc(db, 'users', uid));
    const userEmail = userDoc.exists() ? userDoc.data().email : null;

    // Vérifier si l'utilisateur est admin
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Charger tous les utilisateurs (limité aux données essentielles pour éviter les permissions)
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => ({ id: d.id, email: d.data().email }));

    // Charger tous les votes
    const votesSnap = await getDocs(collection(db, 'votes'));
    const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Charger les catégories
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    const categoriesMap = {};
    categoriesSnap.docs.forEach(d => {
      categoriesMap[d.id] = d.data().title;
    });

    // Organiser les votes par utilisateur
    const votesByUser = {};
    votes.forEach(vote => {
      if (!votesByUser[vote.uid]) {
        votesByUser[vote.uid] = [];
      }
      votesByUser[vote.uid].push(vote);
    });

    // Construire la réponse
    const usersWithVotes = users.map(user => {
      const userVotes = votesByUser[user.id] || [];
      return {
        email: user.email,
        votes: userVotes.map(v => ({
          categoryId: v.categoryId,
          categoryName: categoriesMap[v.categoryId] || v.categoryId,
          nominee: v.nominee,
          timestamp: v.timestamp
        }))
      };
    });

    res.json({
      ok: true,
      users: usersWithVotes,
      totalUsers: users.length,
      totalVotes: votes.length
    });
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: error.message });
  }
};

const admin = require('firebase-admin');
const { getFirestore, collection, getDocs } = require('firebase-admin/firestore');

// Initialiser Firebase Admin avec les variables d'environnement Vercel
let db;

try {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID || "sika-awards",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL
  };

  if (serviceAccount.private_key && serviceAccount.client_email) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = getFirestore();
  } else {
    console.log('Firebase Admin SDK non configuré via variables d\'environnement');
  }
} catch (error) {
  console.error('Erreur initialisation Firebase Admin:', error);
}

module.exports = async (req, res) => {
  // Vérifier la méthode
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!db) {
    return res.status(500).json({ error: 'Firebase Admin SDK non configuré. Configurez les variables d\'environnement FIREBASE_PRIVATE_KEY et FIREBASE_CLIENT_EMAIL.' });
  }

  try {
    // Vérifier le token Firebase
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Charger les emails admin depuis Firestore
    const adminsSnap = await getDocs(collection(db, 'admins'));
    const ADMIN_EMAILS = [];
    adminsSnap.forEach(doc => {
      const data = doc.data();
      const email = data.email || data.email1 || data.email2 || data.email3 || data.email4;
      if (email) ADMIN_EMAILS.push(email);
    });

    // Récupérer l'email de l'utilisateur
    const userRecord = await admin.auth().getUser(uid);
    const userEmail = userRecord.email;

    // Vérifier si l'utilisateur est admin
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }

    // Charger tous les utilisateurs
    const usersSnap = await getDocs(collection(db, 'users'));
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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

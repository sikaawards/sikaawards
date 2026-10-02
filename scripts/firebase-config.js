import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, inMemoryPersistence, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, increment, updateDoc, deleteDoc, runTransaction, arrayRemove, arrayUnion, addDoc, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Remplacez ceci par la configuration de votre nouveau projet Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD02YR3GA-Fy2fVw3mIwpvowlwTxzr3Gus",
  authDomain: "sika-awards.firebaseapp.com",
  projectId: "sika-awards",
  storageBucket: "sika-awards.firebasestorage.app",
  messagingSenderId: "578849327326",
  appId: "1:578849327326:web:632dbefe48fe3729625a4f"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Activer la persistance de session pour que la connexion persiste après redirection
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Erreur configuration persistance:", error);
});

const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Liste des administrateurs autorisés (chargée depuis Firestore)
let ADMIN_EMAILS = [];
let adminEmailsLoaded = false;

// Charger la liste des admins depuis Firestore
async function loadAdminEmails() {
  try {
    const adminsRef = collection(db, "admins");
    const snapshot = await getDocs(adminsRef);

    ADMIN_EMAILS = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Chercher le champ email (supporte email, email1, email2, etc.)
      const email = data.email || data.email1 || data.email2 || data.email3 || data.email4;

      if (email) {
        ADMIN_EMAILS.push(email);
      }
    });

    adminEmailsLoaded = true;
  } catch (error) {
    console.error("Erreur chargement admins:", error);
    // Fallback: liste par défaut si la collection n'existe pas encore
    ADMIN_EMAILS = [];
    adminEmailsLoaded = true;
  }
}

// Charger les admins au démarrage
loadAdminEmails();

export {
  auth,
  db,
  provider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  increment,
  updateDoc,
  deleteDoc,
  runTransaction,
  arrayRemove,
  arrayUnion,
  addDoc,
  onSnapshot,
  orderBy,
  limit,
  ADMIN_EMAILS,
  loadAdminEmails,
  adminEmailsLoaded
};

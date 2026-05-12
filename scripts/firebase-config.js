import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, increment, updateDoc, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Liste des administrateurs autorisés
const ADMIN_EMAILS = ["thesouscote@gmail.com", "lomenouar@gmail.com", "pabelo@gmail.com"];

export { 
  auth, 
  db, 
  provider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  ADMIN_EMAILS
};

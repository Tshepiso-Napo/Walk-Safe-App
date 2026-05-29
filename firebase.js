import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_ppdMC66lpyakVRhkPRnykQEBMGrb1sE",
  authDomain: "safewalk-c1d62.firebaseapp.com",
  projectId: "safewalk-c1d62",
  storageBucket: "safewalk-c1d62.firebasestorage.app",
  messagingSenderId: "531786096760",
  appId: "1:531786096760:web:b6d81b7e6ecf812c924d8d",
  measurementId: "G-FJBYLVNWS0"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
};

if (typeof window !== "undefined") {
  getAnalytics(app);
}

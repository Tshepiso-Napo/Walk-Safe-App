// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_ppdMC66lpyakVRhkPRnykqEBMGrb1sE",
  authDomain: "safewalk-c1d62.firebaseapp.com",
  projectId: "safewalk-c1d62",
  storageBucket: "safewalk-c1d62.firebasestorage.app",
  messagingSenderId: "531786096760",
  appId: "1:531786096760:web:b6d81b7e6ecf812c924d8d",
  measurementId: "G-FJBYLVNWS0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

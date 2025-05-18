import { initializeApp } from "./firebase/firebase-app.js";
import { getAuth, signInWithPopup, TwitterAuthProvider } from "./firebase/firebase-auth.js";
import { getDatabase } from "./firebase/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyATR41dIILYkTwJgTWmcx91Lb_attz8vaw",
  authDomain: "bakery-de534.firebaseapp.com",
  databaseURL: "https://bakery-de534-default-rtdb.firebaseio.com",
  projectId: "bakery-de534",
  storageBucket: "bakery-de534.firebasestorage.app",
  messagingSenderId: "443168470834",
  appId: "1:443168470834:web:52150fe8e87656ef64c92b",
  measurementId: "G-N28BE2605Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export { auth, database, signInWithPopup, TwitterAuthProvider };
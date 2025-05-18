// Real Firebase implementation with local modules
// For Manifest V3, we use local Firebase modules

// Firebase configuration for your app
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

// Function to initialize Firebase with real implementation using local files
async function initializeFirebase() {
  try {
    // Import modules using dynamic import - ensure the correct path
    const appModulePath = chrome.runtime.getURL('firebase/firebase-app.js');
    const authModulePath = chrome.runtime.getURL('firebase/firebase-auth.js');
    const dbModulePath = chrome.runtime.getURL('firebase/firebase-database.js');
    
    const appModule = await import(appModulePath);
    const authModule = await import(authModulePath);
    const databaseModule = await import(dbModulePath);
    
    // Extract the necessary functions from modules
    const { initializeApp } = appModule;
    const { getAuth, signInWithPopup, TwitterAuthProvider } = authModule;
    const { getDatabase, ref, set } = databaseModule;
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);
    const provider = new TwitterAuthProvider();
    
    console.log("Firebase initialized successfully");
    
    return {
      auth,
      database,
      signInWithPopup,
      TwitterAuthProvider,
      provider,
      ref,
      set
    };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

export { initializeFirebase };

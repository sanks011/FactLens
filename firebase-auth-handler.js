// Firebase Auth Handler for Twitter Authentication
// Following Firebase documentation for Twitter Authentication

// Import Firebase modules from local files
async function loadFirebaseModules() {
  const appModulePath = chrome.runtime.getURL('firebase/firebase-app.js');
  const authModulePath = chrome.runtime.getURL('firebase/firebase-auth.js');
  const dbModulePath = chrome.runtime.getURL('firebase/firebase-database.js');
  
  try {
    const appModule = await import(appModulePath);
    const authModule = await import(authModulePath);
    const dbModule = await import(dbModulePath);
    
    return { appModule, authModule, dbModule };
  } catch (error) {
    console.error("Error loading Firebase modules:", error);
    throw error;
  }
}

// Firebase configuration
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

// Initialize Firebase and set up auth
let auth, database, provider;

// Initialize Firebase
async function initializeFirebase() {
  try {
    const { appModule, authModule, dbModule } = await loadFirebaseModules();
    
    const app = appModule.initializeApp(firebaseConfig);
    auth = authModule.getAuth(app);
    database = dbModule.getDatabase(app);
    provider = new authModule.TwitterAuthProvider();
      // Create the Firebase service object with all needed methods
    const firebaseService = {
      auth,
      database,
      provider,
      signInWithTwitter: signInWithTwitter,
      getCurrentUser: () => auth.currentUser,
      onAuthStateChanged: (callback) => auth.onAuthStateChanged(callback),
      saveUserData: async (user, credential) => {
        try {
          await dbModule.set(dbModule.ref(database, `users/${user.uid}`), {
            uid: user.uid,
            displayName: user.displayName,
            xAccessToken: credential.accessToken,
            xSecret: credential.secret,
            queryCount: 0,
            lastReset: Date.now()
          });
          return true;
        } catch (error) {
          console.error("Error saving user data:", error);
          return false;
        }      }
    };
    
    // Debug log to verify firebaseService structure
    console.log("Firebase service created:", firebaseService);
    console.log("Has signInWithTwitter:", !!firebaseService.signInWithTwitter);
    
    return firebaseService;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    throw error;
  }
}

// Sign in with Twitter
// Sign in with Twitter - defined before initializeFirebase so it's available when referenced
async function signInWithTwitter() {
  try {
    console.log("signInWithTwitter called", auth, provider);
    
    // Make sure we have the auth module loaded
    const { authModule } = await loadFirebaseModules();
    console.log("Firebase auth module loaded for signInWithTwitter", authModule);
    
    // Check if signInWithPopup is available
    if (!authModule.signInWithPopup) {
      console.error("signInWithPopup not found in auth module");
      throw new Error("Firebase auth method signInWithPopup not available");
    }
    
    // Use the auth module's signInWithPopup directly
    const result = await authModule.signInWithPopup(auth, provider);
    
    // The signed-in user info
    const user = result.user;
    
    // Twitter credential
    const credential = authModule.TwitterAuthProvider.credentialFromResult(result);
    
    return {
      user,
      credential
    };
  } catch (error) {
    console.error("Twitter sign-in error:", error);
    throw error;
  }
}

export { initializeFirebase };

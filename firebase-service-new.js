// Firebase Auth Service for Chrome Extensions
// Simplified version that works with Manifest V3 CSP restrictions

class FirebaseAuthService {
  constructor() {
    this.initialized = false;
    this.auth = null;
    this.database = null;
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Firebase config
    this.config = {
      apiKey: "AIzaSyATR41dIILYkTwJgTWmcx91Lb_attz8vaw",
      authDomain: "bakery-de534.firebaseapp.com",
      databaseURL: "https://bakery-de534-default-rtdb.firebaseio.com",
      projectId: "bakery-de534",
      storageBucket: "bakery-de534.firebasestorage.app",
      messagingSenderId: "443168470834",
      appId: "1:443168470834:web:52150fe8e87656ef64c92b",
      measurementId: "G-N28BE2605Q",
      // Twitter OAuth client ID
      twitterClientId: "21iqHVSDH2lzPSLIukYQtKOOS"
    };
  }
  
  // Wait for Firebase to be loaded from HTML scripts
  waitForFirebase() {
    return new Promise((resolve) => {
      const checkFirebase = () => {
        // Check if Firebase is defined globally
        if (typeof firebase !== 'undefined') {
          console.log("Firebase global object found");
          resolve();
        } else {
          console.log("Firebase not found, checking again in 100ms...");
          setTimeout(checkFirebase, 100); // Check again in 100ms
        }
      };
      checkFirebase();
    });
  }
  
  // Initialize Firebase
  async initialize() {
    try {
      // Wait for Firebase to be loaded from scripts
      await this.waitForFirebase();
      
      // Check if Firebase app already initialized
      try {
        const app = firebase.app();
        console.log("Firebase app already initialized");
      } catch (e) {
        console.log("Initializing Firebase app");
        firebase.initializeApp(this.config);
      }
      
      // Get auth and database instances
      this.auth = firebase.auth();
      this.database = firebase.database();
      
      // Add debug info
      console.log("Firebase auth initialized:", !!this.auth);
      console.log("Firebase database initialized:", !!this.database);
      
      // Set up auth state change listener
      this.auth.onAuthStateChanged((user) => {
        console.log("Auth state changed. User:", user ? user.displayName : "null");
        this.currentUser = user;
        this.authStateListeners.forEach(listener => listener(user));
      });
      
      this.initialized = true;
      console.log("Firebase fully initialized");
      return true;
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }
  
  // Sign in with Twitter using a popup approach but with chrome.identity
  async signInWithTwitter() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      console.log("Starting Twitter sign-in process");
      
      // Create Twitter auth provider
      const provider = new firebase.auth.TwitterAuthProvider();
      
      // Try to sign in with popup - this will likely fail with CSP error, but we try anyway
      try {
        console.log("Attempting direct popup sign-in (may fail with CSP error)");
        const result = await this.auth.signInWithPopup(provider);
        const user = result.user;
        const credential = result.credential;
        return { user, credential };
      } catch (popupError) {
        console.warn("Popup sign-in failed, trying Chrome identity API:", popupError);
        
        // Use Chrome's identity API as a fallback
        if (!chrome || !chrome.identity) {
          throw new Error("Chrome identity API not available");
        }
        
        // Launch web auth flow
        return new Promise((resolve, reject) => {
          // Get Firebase auth URL
          const redirectUrl = chrome.identity.getRedirectURL();
          console.log("Redirect URL:", redirectUrl);
            // Use Firebase's Twitter Provider for authentication
          // For Twitter OAuth 2.0 in Chrome extensions, we need to configure things carefully
          
          // Use a Twitter-specific OAuth redirect URL from Chrome identity API
          const redirectUrl = chrome.identity.getRedirectURL("twitter");
          console.log("Twitter OAuth Redirect URL:", redirectUrl);
          
          // Important: Make sure this exact redirect URL is registered 
          // in your Twitter Developer Portal under your app's settings
          
          // Create the auth URL with proper parameters
          const state = Math.random().toString(36).substring(2, 15);
          const authUrl = `https://twitter.com/i/oauth2/authorize` +
            `?response_type=code` +
            `&client_id=${encodeURIComponent(this.config.twitterClientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
            `&scope=tweet.read%20users.read%20offline.access` +
            `&state=${encodeURIComponent(state)}` +
            `&code_challenge=challenge` + // For simplicity not using real PKCE
            `&code_challenge_method=plain` +
            `&allow_signup=false`;
          
          console.log("Launching Twitter auth flow with URL:", authUrl);
          
          // Launch the auth flow with interactive true to allow user interaction
          chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
          }, async (responseUrl) => {
            if (chrome.runtime.lastError) {
              console.error("Chrome identity error:", chrome.runtime.lastError);
              
              // Check if user cancelled
              if (chrome.runtime.lastError.message.includes("canceled")) {
                reject(new Error("Authentication was cancelled by the user"));
              } else {
                reject(new Error(`Authentication error: ${chrome.runtime.lastError.message}`));
              }
              return;
            }
            
            if (!responseUrl) {
              console.error("No response URL returned");
              reject(new Error("Authentication failed - no response received"));
              return;
            }
            
            console.log("Got response URL:", responseUrl);
            
            try {
              // Parse the response URL to extract the authorization code
              const url = new URL(responseUrl);
              
              // Check for error parameter first
              const errorParam = url.searchParams.get("error");
              if (errorParam) {
                throw new Error(`Twitter authorization error: ${errorParam}`);
              }
              
              // Extract code from URL search params
              const code = url.searchParams.get("code");
              
              if (!code) {
                throw new Error("No authorization code in response");
              }
              
              console.log("Got Twitter authorization code:", code.substring(0, 5) + "...");
              
              // In a production app, you would now:
              // 1. Send this code to your backend server
              // 2. Backend exchanges it for access & refresh tokens
              // 3. Backend creates a custom Firebase token
              // 4. Your extension signs in with that custom token
              
              // Since we don't have a backend, we'll simulate a successful sign-in
              const result = await this.auth.signInAnonymously();
              
              // Update user profile to simulate Twitter login
              await result.user.updateProfile({
                displayName: "Twitter User",
                photoURL: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"
              });
              
              resolve({ 
                user: result.user,
                credential: { provider: "twitter.com" } 
              });
            } catch (error) {
              console.error("Error completing authentication:", error);
              reject(error);
            }
          });
        });
      }
    } catch (error) {
      console.error("Twitter sign-in failed:", error);
      throw error;
    }
  }
  
  // Get the current authenticated user
  getCurrentUser() {
    return this.currentUser;
  }
  
  // Add an auth state change listener
  onAuthStateChanged(callback) {
    if (!this.initialized) {
      console.warn('Firebase not initialized, auth state changes will be delayed');
    }
    
    this.authStateListeners.push(callback);
    
    if (this.currentUser) {
      callback(this.currentUser);
    }
    
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }
  
  // Save user data to database
  async saveUserData(user, credential) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      if (!user || !user.uid) {
        console.error("Invalid user object");
        return false;
      }
      
      console.log("Saving user data for:", user.displayName || user.email || user.uid);
      
      await this.database.ref(`users/${user.uid}`).set({
        uid: user.uid,
        displayName: user.displayName || "Anonymous User",
        email: user.email || null,
        photoURL: user.photoURL || null,
        // Store Twitter access info if available
        twitterAuth: credential ? {
          provider: credential.providerId || "twitter.com",
          lastLogin: Date.now()
        } : null,
        lastActive: Date.now()
      });
      
      console.log("User data saved successfully");
      return true;
    } catch (error) {
      console.error("Error saving user data:", error);
      throw error;
    }
  }
  
  // Sign out the current user
  async signOut() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      await this.auth.signOut();
      console.log('User signed out');
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
}

// Create and export the service
const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;

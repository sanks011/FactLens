// Firebase Auth Service for Chrome Extensions
// Version optimized for Manifest V3 CSP restrictions

class FirebaseAuthService {  constructor() {
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
      // IMPORTANT: In the Twitter Developer Portal, you MUST register the EXACT chrome-extension://[YOUR-EXTENSION-ID].chromiumapp.org/ redirect URL
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
          console.debug("Waiting for Firebase: Make sure firebase-app.js, firebase-auth.js, and firebase-database.js are properly loaded in popup.html");
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
  
  // Sign in with Twitter using Chrome identity API
  async signInWithTwitter() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      console.log("Starting Twitter sign-in process");
      
      // For Manifest V3, we'll use the Chrome Identity API directly
      if (!chrome || !chrome.identity) {
        throw new Error("Chrome identity API not available");
      }
      
      return new Promise((resolve, reject) => {
        // Get the extension ID for proper redirect URL
        const extensionId = chrome.runtime.id;
        console.log("Extension ID:", extensionId);
        
        // Properly formatted redirect URL for Twitter
        const redirectURL = `https://${extensionId}.chromiumapp.org/`;
        console.log("OAuth Redirect URL:", redirectURL);
        
        // Generate state for security
        const state = Math.random().toString(36).substring(2, 15);
        
        // Generate a simpler code verifier for PKCE
        const generateCodeVerifier = () => {
          // Generate a random string for PKCE
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          const randomValues = new Uint8Array(43);
          crypto.getRandomValues(randomValues);
          randomValues.forEach(val => result += chars.charAt(val % chars.length));
          return result;
        };
        
        const codeVerifier = generateCodeVerifier();
        // Store code verifier in local storage
        chrome.storage.local.set({ 'twitter_code_verifier': codeVerifier });
        
        // Use the verifier directly as the challenge for simplicity
        const codeChallenge = codeVerifier;
          // Build Twitter OAuth 2.0 URL with enhanced parameters
        const authUrl = `https://twitter.com/i/oauth2/authorize` +
          `?response_type=code` +
          `&client_id=${encodeURIComponent(this.config.twitterClientId)}` +
          `&redirect_uri=${encodeURIComponent(redirectURL)}` +
          `&scope=tweet.read%20users.read%20offline.access` +
          `&state=${encodeURIComponent(state)}` +
          `&code_challenge=${encodeURIComponent(codeChallenge)}` +
          `&code_challenge_method=plain` +
          `&force_login=false` +
          `&allow_signup=true` +
          `&prompt=consent`;
        
        console.log("Launching auth flow with URL:", authUrl);
        
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, async (responseUrl) => {
          console.log("Auth flow completed, checking response");
          
          // Handle errors from chrome.identity
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.error("Chrome Identity Error:", errorMsg);
            
            // Show more specific error messages
            if (errorMsg.includes("canceled")) {
              reject(new Error("Authentication was canceled by the user"));
            } else if (errorMsg.includes("not registered")) {
              reject(new Error("The redirect URL is not registered in Twitter Developer Portal. Please register the exact URL: " + redirectURL));
            } else if (errorMsg.includes("OAuth2 not granted")) {
              reject(new Error("Permission not granted. Please ensure all required permissions are requested."));
            } else {
              reject(new Error(`Chrome Identity Error: ${errorMsg}`));
            }
            return;
          }
          
          if (!responseUrl) {
            reject(new Error("No response URL returned from authentication"));
            return;
          }
          
          try {
            console.log("Response URL:", responseUrl);
            
            // Parse response URL
            const url = new URL(responseUrl);
            
            // Check for error in the URL
            if (url.searchParams.has("error")) {
              const error = url.searchParams.get("error");
              const description = url.searchParams.get("error_description") || "Unknown error";
              throw new Error(`Twitter OAuth error: ${error} - ${description}`);
            }
            
            // Check state parameter matches for security
            const returnedState = url.searchParams.get("state");
            if (returnedState !== state) {
              throw new Error("OAuth state mismatch - possible CSRF attack");
            }
            
            // Get authorization code
            const code = url.searchParams.get("code");
            if (!code) {
              throw new Error("No authorization code in response");
            }
            
            console.log("Got authorization code:", code.substring(0, 5) + "...");
            
            // In a real implementation, we would:
            // 1. Send this code to your server
            // 2. Server exchanges it for access token using client_secret
            // 3. Server creates a Firebase custom token
            // 4. Client signs in with that custom token
            
            // For demo purposes, we're using anonymous sign-in
            console.log("Using anonymous sign-in for demonstration");
            const result = await this.auth.signInAnonymously();
            
            // Update the profile to simulate Twitter login
            await result.user.updateProfile({
              displayName: "X User", 
              photoURL: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"
            });
            
            resolve({
              user: result.user,
              // Create mock credential for database storage
              credential: {
                providerId: "twitter.com",
                signInMethod: "oauth",
                accessToken: "mock-token-for-demonstration"
              }
            });
          } catch (error) {
            console.error("Error processing OAuth response:", error);
            reject(error);
          }
        });
      });
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
          accessToken: credential.accessToken ? "present" : "none",
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

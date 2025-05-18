// Firebase Auth Service for Chrome Extensions
// Uses local Firebase JS libraries loaded via script tags (non-module version)

// This class provides a unified interface for Firebase authentication
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
      // Twitter OAuth client ID - needed for the Twitter sign-in
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
  
  // Sign in with Twitter using Chrome's identity API approach
  async signInWithTwitter() {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      console.log("Starting Twitter sign-in process with Chrome identity API");
      
      // Create Twitter auth provider
      const provider = new firebase.auth.TwitterAuthProvider();
      
      // For Chrome extension, we need to use the identity API
      // This is critical because regular popups are blocked by Chrome's CSP in extensions
      return new Promise((resolve, reject) => {
        if (!chrome || !chrome.identity) {
          console.error("Chrome identity API not available");
          reject(new Error("Chrome identity API not available"));
          return;
        }

        // Get the OAuth redirect URL
        const redirectUri = chrome.identity.getRedirectURL();
        console.log("Redirect URI:", redirectUri);
        
        // Add the redirect URI to the provider
        provider.setCustomParameters({
          'redirect_uri': redirectUri
        });
        
        // Get the Twitter auth URL
        // Note: We construct this manually to avoid CSP issues
        const authUrl = `https://twitter.com/i/oauth2/authorize` + 
            `?client_id=${encodeURIComponent(this.config.twitterClientId || '21iqHVSDH2lzPSLIukYQtKOOS')}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=tweet.read%20users.read%20offline.access` +
            `&state=firebase_${Math.random().toString(36).substring(2, 15)}` +
            `&code_challenge=plain_challenge` +
            `&code_challenge_method=plain`;
        
        console.log("Auth URL:", authUrl);
        
        // Launch the authentication flow
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, async (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome identity error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!responseUrl) {
            console.error('No response from Twitter authorization');
            reject(new Error('No response from Twitter authorization'));
            return;
          }
          
          try {
            console.log("Got response URL:", responseUrl);
            
            // The response contains a token that Firebase can use
            // We need to extract and parse this token
            const urlObj = new URL(responseUrl);
            
            // Sign in with token from the URL
            // This part is tricky - we'll need to use signInWithCredential
            // after extracting data from the response URL
            
            // First attempt: Try to use the response URL directly
            try {
              // Use getAuth from the redirected URL (Firebase will handle this internally)
              const result = await this.auth.getRedirectResult();
              console.log("Got redirect result:", result);
              resolve({ 
                user: result.user, 
                credential: result.credential 
              });
              return;
            } catch (redirectError) {
              console.warn("Could not use redirect result:", redirectError);
              
              // Second attempt: Try to get credential from the URL
              try {
                // Parse the hash fragment
                const hash = urlObj.hash.substring(1);
                const params = new URLSearchParams(hash);
                
                // Get the OAuth token and secret
                const oauth_token = params.get('oauth_token');
                const oauth_token_secret = params.get('oauth_token_secret');
                
                if (oauth_token && oauth_token_secret) {
                  // Create credential
                  const credential = firebase.auth.TwitterAuthProvider.credential(
                    oauth_token,
                    oauth_token_secret
                  );
                  
                  // Sign in with credential
                  const result = await this.auth.signInWithCredential(credential);
                  resolve({ 
                    user: result.user, 
                    credential: credential 
                  });
                  return;
                }
              } catch (credentialError) {
                console.error("Failed to extract credential:", credentialError);
              }
              
              // If we got here, we couldn't extract the credential
              // Let's try a different approach - fallback to popup
              try {
                const result = await this.auth.signInWithPopup(provider);
                resolve({ 
                  user: result.user, 
                  credential: result.credential 
                });
              } catch (popupError) {
                console.error("Popup sign-in failed:", popupError);
                reject(popupError);
              }
            }
          } catch (error) {
            console.error('Error during Twitter auth flow:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Twitter sign-in error:', error);
      throw error;
    }
        
        return { user, credential };
      } catch (fallbackError) {
        console.error('Twitter fallback sign-in also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }
  
  // Get the current user
  getCurrentUser() {
    return this.currentUser;
  }
  
  // Add auth state change listener
  onAuthStateChanged(callback) {
    this.authStateListeners.push(callback);
    
    // Call immediately if we already have a user
    if (this.currentUser) {
      callback(this.currentUser);
    }
    
    return () => {
      this.authStateListeners = this.authStateListeners.filter(
        listener => listener !== callback
      );
    };
  }
    // Save user data to database
  async saveUserData(user, credential) {
    if (!this.initialized) {
      throw new Error('Firebase not initialized');
    }
    
    try {
      // Log what we've received for debugging
      console.log("Saving user data for:", user?.displayName);
      console.log("Credential type:", credential ? typeof credential : "null");
      
      // Extract Twitter tokens based on what's available in the credential object
      let xAccessToken = null;
      let xSecret = null;
      
      // Handle different ways the credential might be structured
      if (credential) {
        if (credential.accessToken) {
          xAccessToken = credential.accessToken;
        } else if (credential.oauthAccessToken) {
          xAccessToken = credential.oauthAccessToken;
        }
        
        if (credential.secret) {
          xSecret = credential.secret;
        } else if (credential.oauthTokenSecret) {
          xSecret = credential.oauthTokenSecret;
        }
      }
      
      // Save to Firebase database
      await this.database.ref(`users/${user.uid}`).set({
        uid: user.uid,
        displayName: user.displayName || "User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        xAccessToken: xAccessToken,
        xSecret: xSecret,
        queryCount: 0,
        lastReset: Date.now(),
        lastLogin: Date.now()
      });
      
      console.log("User data saved successfully");
      return true;
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;    }
  }
  
  // Get the current authenticated user
  getCurrentUser() {
    return this.currentUser;
  }
  
  // Add an auth state change listener
  onAuthStateChanged(callback) {
    if (!this.initialized) {
      console.warn('Firebase not initialized, auth state changes will be delayed');
      // Still add the listener, it will be called once Firebase initializes
    }
    
    // Add the callback to our listener list
    this.authStateListeners.push(callback);
    
    // If we already have a user, call the callback immediately
    if (this.currentUser) {
      callback(this.currentUser);
    }
    
    // Return a function to unsubscribe
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
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

// Custom Authentication Handler for FactLens
// This provides an alternative to anonymous authentication that works
// even when anonymous auth is disabled in Firebase

class CustomAuthHandler {
  constructor() {
    this.localUserId = null;
    this.displayName = "X User";
    this.photoURL = "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png";
  }
  
  // Initialize and get or create a persistent user ID
  async initialize() {
    try {
      // Try to get existing user ID from storage
      const data = await new Promise(resolve => {
        chrome.storage.local.get(['factlens_user_id'], resolve);
      });
      
      if (data && data.factlens_user_id) {
        console.log("Retrieved existing user ID");
        this.localUserId = data.factlens_user_id;
      } else {
        // Generate a new persistent ID if none exists
        this.localUserId = this._generateUserId();
        await new Promise(resolve => {
          chrome.storage.local.set({
            'factlens_user_id': this.localUserId
          }, resolve);
        });
        console.log("Generated new persistent user ID");
      }
      
      return this.localUserId;
    } catch (error) {
      console.error("Error initializing custom auth:", error);
      throw error;
    }
  }
  
  // Create a mock user object that simulates Firebase User
  createMockUser(twitterTokens = null) {
    if (!this.localUserId) {
      throw new Error("CustomAuthHandler not initialized. Call initialize() first.");
    }
    
    const now = new Date();
    
    // Mock user object with the same structure as Firebase User
    return {
      uid: this.localUserId,
      displayName: this.displayName,
      photoURL: this.photoURL,
      email: null,
      phoneNumber: null,
      emailVerified: false,
      isAnonymous: true,
      metadata: {
        creationTime: now.toISOString(),
        lastSignInTime: now.toISOString()
      },
      providerData: [
        {
          providerId: "twitter.com",
          uid: this.localUserId,
          displayName: this.displayName,
          photoURL: this.photoURL,
          email: null,
          phoneNumber: null
        }
      ],
      // Methods
      getIdToken: () => Promise.resolve("mock-id-token"),
      delete: () => Promise.resolve(),
      reload: () => Promise.resolve(),
      toJSON: () => ({ uid: this.localUserId }),
      // Add updateProfile method
      updateProfile: (profileData) => {
        if (profileData.displayName) this.displayName = profileData.displayName;
        if (profileData.photoURL) this.photoURL = profileData.photoURL;
        return Promise.resolve();
      }
    };
  }
  
  // Generate a random user ID
  _generateUserId() {
    // Generate a Firebase-like ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const length = 28;
    
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    return result;
  }
  
  // Clear user data
  async clearUserData() {
    await new Promise(resolve => {
      chrome.storage.local.remove(['factlens_user_id'], resolve);
    });
    this.localUserId = null;
    console.log("Custom auth user data cleared");
  }
}

// Create and export the handler
const customAuthHandler = new CustomAuthHandler();
export default customAuthHandler;

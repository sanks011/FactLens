// Background script for FactLens Chrome Extension
import grokService from './grok-service.js';

console.log("FactLens background script loaded");

// Listen for installation event
chrome.runtime.onInstalled.addListener(() => {
  console.log("FactLens extension installed");
  
  // Initialize Firebase in the background for persistent authentication
  initFirebaseInBackground();
  
  // Initialize the Grok service
  grokService.initialize();
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  
  if (message.action === 'signInWithTwitter') {
    // Handle Twitter sign-in request
    handleTwitterSignIn()
      .then(result => {
        console.log("Twitter sign-in successful in background");
        sendResponse({ success: true, user: result.user });
      })
      .catch(error => {
        console.error("Twitter sign-in error in background:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Return true to indicate async response
  }
  
  if (message.action === 'getCurrentUser') {
    // Get current user and send back to popup
    const user = getFirebaseCurrentUser();
    sendResponse({ user });
    return false; // Synchronous response
  }
  
  if (message.action === 'factCheck') {
    // Handle fact check requests
    console.log("Fact check request received in background");
    
    // Use the grokService to perform the fact check
    grokService.factCheck(message.text)
      .then(result => {
        console.log("Fact check completed successfully");
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error("Fact check error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Return true to indicate async response
  }
  
  return true; // Return true for async response
});

// Initialize Firebase in the background script
function initFirebaseInBackground() {
  // We'll load Firebase dynamically when needed
  // This helps avoid CSP issues with the background service worker
  console.log("Firebase will be initialized when needed");
}

// Handle Twitter sign-in
async function handleTwitterSignIn() {
  try {
    console.log("Twitter sign-in handler in background script");
      // Import the Firebase service dynamically
    const module = await import('./firebase-service-v3.js');
    const firebaseAuthService = module.default;
    
    // Initialize Firebase if needed
    if (!firebaseAuthService.initialized) {
      console.log("Initializing Firebase in background");
      await firebaseAuthService.initialize();
    }
    
    // Perform the Twitter sign-in
    console.log("Calling Twitter sign-in from background");
    const result = await firebaseAuthService.signInWithTwitter();
    
    // Save user data if sign-in was successful
    if (result && result.user) {
      await firebaseAuthService.saveUserData(result.user, result.credential);
    }
    
    return result;
  } catch (error) {
    console.error("Background Twitter sign-in error:", error);
    throw error;
  }
}

// Get current Firebase user
function getFirebaseCurrentUser() {
  // This is a placeholder - the actual implementation happens in firebase-service.js
  return null;
}

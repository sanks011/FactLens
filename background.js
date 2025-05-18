// Background script for FactLens Chrome Extension
console.log("FactLens background script loaded");

// Listen for installation event
chrome.runtime.onInstalled.addListener(() => {
  console.log("FactLens extension installed");
  
  // Initialize Firebase in the background for persistent authentication
  initFirebaseInBackground();
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
    // This function will be implemented with Chrome identity API
    // when we receive a signInWithTwitter message from popup
    console.log("Twitter sign-in handler in background script");
    
    // This is just a placeholder - the actual implementation
    // happens in firebase-service.js
    return { user: null };
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

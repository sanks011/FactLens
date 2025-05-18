import firebaseService from "./firebase-service-new.js";

// Initialize Firebase when the popup loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    document.getElementById("result").innerText = "Initializing Firebase...";
    await firebaseService.initialize();
    
    // Debug - log the service object
    console.log("Firebase service initialized:", firebaseService);
    console.log("Has signInWithTwitter method:", !!firebaseService.signInWithTwitter);
    
    // Check auth state after Firebase is initialized
    checkAuthState();
  } catch (error) {
    document.getElementById("result").innerText = `Firebase initialization error: ${error.message}`;
    console.error(error);
  }
});

// Function to check authentication state
function checkAuthState() {
  firebaseService.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      document.getElementById("signIn").style.display = "none";
      document.getElementById("signOut").style.display = "block";
      document.getElementById("factCheck").disabled = false;
      document.getElementById("result").innerText = `Signed in as ${user.displayName || 'User'}`;
      console.log("User authenticated:", user.displayName);
    } else {
      // User is not signed in
      document.getElementById("signIn").style.display = "block";
      document.getElementById("signIn").disabled = false;
      document.getElementById("signOut").style.display = "none";
      document.getElementById("factCheck").disabled = true;
      document.getElementById("result").innerText = "Please sign in to fact-check.";
      console.log("No user authenticated");
    }
  });
}

document.getElementById("signIn").addEventListener("click", async () => {
  try {
    document.getElementById("result").innerText = "Signing in with Twitter...";
    document.getElementById("signIn").disabled = true;
    
    console.log("Attempting Twitter sign-in");
    
    // Check if signInWithTwitter exists
    if (!firebaseService || typeof firebaseService.signInWithTwitter !== 'function') {
      console.error("signInWithTwitter is not available:", firebaseService);
      throw new Error("Twitter authentication not available");
    }
    
    // Sign in with Twitter using our service
    console.log("Calling signInWithTwitter");
    const result = await firebaseService.signInWithTwitter();
    console.log("Twitter sign-in result:", result);
    
    if (!result || !result.user) {
      throw new Error("Sign-in failed - no user returned");
    }
    
    const { user, credential } = result;
    
    // Store user data in Realtime Database
    console.log("Saving user data");
    await firebaseService.saveUserData(user, credential);
    console.log("User data saved");

    // UI updates will happen in the onAuthStateChanged handler
    document.getElementById("result").innerText = `Signed in as ${user.displayName || 'User'}`;
  } catch (error) {
    console.error("Twitter sign-in error:", error);
    document.getElementById("result").innerText = `Error: ${error.message || 'Sign-in failed'}`;
    document.getElementById("signIn").disabled = false;
  }
});

// Add sign out button handler
document.getElementById("signOut").addEventListener("click", async () => {
  try {
    document.getElementById("result").innerText = "Signing out...";
    await firebaseService.signOut();
    // UI will be updated in the onAuthStateChanged handler
  } catch (error) {
    console.error("Sign-out error:", error);
    document.getElementById("result").innerText = `Error signing out: ${error.message}`;
  }
});

// Auth state is checked in the checkAuthState function when popup loads

async function factCheckWithGrok(text) {
  // Show loading state
  document.getElementById("loading").style.display = "block";
  document.getElementById("result").innerText = "Analyzing content...";
  document.getElementById("factCheck").disabled = true;
  
  // Get current user from firebaseService
  const user = firebaseService.getCurrentUser();
  if (!user) {
    document.getElementById("result").innerText = "Please sign in to fact-check.";
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    return;
  }

  try {
    console.log("Sending fact-check request for user:", user.uid);
    console.log("Text length:", text ? text.length : 0);
    
    // Truncate text if it's too long (API might have limits)
    const truncatedText = text && text.length > 5000 ? text.substring(0, 5000) : text;
    
    const response = await fetch("http://localhost:3000/fact-check", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.uid}` // Add auth header
      },
      body: JSON.stringify({ 
        text: truncatedText, 
        userId: user.uid
      })
    });
    
    // Hide loading state
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    if (data.error) {
      document.getElementById("result").innerText = `Error: ${data.error}`;
    } else {
      document.getElementById("result").innerText = data.result || "No result returned from fact-check.";
    }
  } catch (error) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    document.getElementById("result").innerText = `Error: ${error.message || "Could not contact fact-check server."}`;
    console.error(error);
  }
}

document.getElementById("factCheck").addEventListener("click", () => {
  // First ensure we're signed in
  const user = firebaseService.getCurrentUser();
  if (!user) {
    document.getElementById("result").innerText = "Please sign in first.";
    return;
  }
  
  document.getElementById("result").innerText = "Extracting page content...";
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      document.getElementById("result").innerText = "Error: Could not identify current tab.";
      return;
    }
    
    try {
      chrome.tabs.sendMessage(tabs[0].id, { message: "scrape_content" }, (response) => {
        // Check for runtime errors (like content script not loaded)
        if (chrome.runtime.lastError) {
          console.error("Error sending message to content script:", chrome.runtime.lastError);
          document.getElementById("result").innerText = 
            "Error: Content script not available. Try refreshing the page.";
          return;
        }
        
        // Validate the response
        if (!response) {
          document.getElementById("result").innerText = "Error: No response from content script.";
          return;
        }
        
        const text = response.text || "";
        if (!text || text.trim() === "") {
          document.getElementById("result").innerText = "Error: No content found on page to fact-check.";
          return;
        }
        
        // We have content, send to fact-checking service
        factCheckWithGrok(text);
      });
    } catch (error) {
      console.error("Error in factCheck handler:", error);
      document.getElementById("result").innerText = `Error: ${error.message}`;
    }
  });
});
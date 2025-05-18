// Updated popup.js for FactLens with direct Twitter authentication
import firebaseService from "./firebase-service-v3.js";
import { authenticateWithTwitter, getTwitterTokens } from "./twitter-oauth-v2.js";

// Initialize Firebase when the popup loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    document.getElementById("result").innerText = "Initializing Firebase...";
    await firebaseService.initialize();
    
    console.log("Firebase service initialized:", firebaseService);
    
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
      
      // Store debug info
      const debugData = {
        uid: user.uid,
        authTime: new Date().toISOString()
      };
      chrome.storage.local.set({ 'factle_debug_data': debugData });
      
      // Enhances success message with X profile info
      if (user.photoURL) {
        document.getElementById("result").innerHTML = `
          <div class="user-info">
            <img src="${user.photoURL}" alt="Profile" class="profile-img">
            <span>Signed in as ${user.displayName || 'User'}</span>
          </div>
        `;
      }
    } else {
      // User is not signed in
      document.getElementById("signIn").style.display = "block";
      document.getElementById("signIn").disabled = false;
      document.getElementById("signOut").style.display = "none";
      document.getElementById("factCheck").disabled = true;
      document.getElementById("result").innerHTML = `
        <p>Please sign in with X to fact-check content.</p>
        <p class="note">This extension requires X authentication to access Grok.</p>
      `;
      console.log("No user authenticated");
    }
  });
}

document.getElementById("signIn").addEventListener("click", async () => {
  try {
    document.getElementById("result").innerText = "Starting Twitter sign-in...";
    document.getElementById("signIn").disabled = true;
    
    console.log("Starting direct Twitter authentication");
    
    // Update UI to inform user
    document.getElementById("result").innerHTML = `
      <div class="twitter-auth-info">
        <p>Authenticating with X...</p>
        <p>Using pre-configured authentication for FactLens.</p>
      </div>
    `;
    
    // Use our dedicated Twitter OAuth handler
    setTimeout(async () => {
      try {
        // Authenticate with our direct Twitter method
        const twitterAuthResult = await authenticateWithTwitter();
        console.log("Twitter authentication successful:", twitterAuthResult);
        
        // Get the tokens (already stored by authenticateWithTwitter)
        const tokens = await getTwitterTokens();
        console.log("Using Twitter tokens:", tokens);
        
        // Now sign in to Firebase
        const result = await firebaseService.auth.signInAnonymously();
        console.log("Firebase sign-in result:", result);
        
        // Update the profile with Twitter info
        await result.user.updateProfile({
          displayName: "X User", 
          photoURL: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"
        });
        
        const user = result.user;
        
        // Create Twitter credential for database
        const credential = {
          providerId: "twitter.com",
          signInMethod: "direct-auth",
          accessToken: tokens.accessToken
        };
        
        // Store user data in Realtime Database
        console.log("Saving user data");
        document.getElementById("result").innerText = "Authentication successful. Saving user data...";
        await firebaseService.saveUserData(user, credential);
        console.log("User data saved");

        // UI updates will happen in the onAuthStateChanged handler
      } catch (error) {
        console.error("Authentication error:", error);
        
        // Format error message
        let errorMessage = error.message || 'Sign-in failed';
        let formattedError = `<div class="error-message"><p>Error: ${errorMessage}</p></div>`;
        
        document.getElementById("result").innerHTML = formattedError;
        document.getElementById("signIn").disabled = false;
      }
    }, 500);
  } catch (error) {
    console.error("Authentication setup error:", error);
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

// Fact checking functionality
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
    console.log("Starting fact-check for user:", user.uid);
    console.log("Text length:", text ? text.length : 0);
    
    // Truncate text if it's too long (Grok might have input limits)
    const truncatedText = text && text.length > 5000 ? text.substring(0, 5000) : text;
    
    document.getElementById("result").innerText = "Connecting to Grok... (a new tab will open briefly)";
    
    // Send a message to the background script to perform the fact check
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "factCheck", text: truncatedText },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    // Hide loading state
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    
    if (!response || !response.success) {
      throw new Error(response?.error || "Failed to get response from Grok");
    }
    
    // Format and display the result
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = formatGrokResult(response.result);
  } catch (error) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    document.getElementById("result").innerText = `Error: ${error.message || "Could not complete fact check with Grok."}`;
    console.error("Fact check error:", error);
  }
}

// Format Grok's response for better readability and visual appeal
function formatGrokResult(result) {
  if (!result) return "No results were returned.";

  // Clean up the result text
  result = result.trim()
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks
    .replace(/^\s*Grok:\s*/i, ''); // Remove "Grok:" prefix if present
  
  // Add header to the fact check result
  let output = `<div class="fact-check-result">
    <div class="fact-check-header">
      <h3>Fact Check Results</h3>
      <div class="powered-by">Powered by Grok AI on X</div>
    </div>`;

  // Look for claims/facts structure in the response
  const claimRegex = /(?:Claim|Statement|Fact)\s*(?:\d+)?:\s*["']?(.+?)["']?(?=\s*(?:True|False|Accurate|Inaccurate|Misleading|Partially))/gi;
  let claimsFound = false;
  let match;
  let claimsHtml = '';
  
  // Extract claims and their verdicts
  while ((match = claimRegex.exec(result)) !== null) {
    claimsFound = true;
    const claim = match[1].trim();
    const afterClaim = result.slice(match.index + match[0].length, match.index + match[0].length + 100);
    
    let verdict = 'Unknown';
    let verdictClass = 'verdict-unknown';
    
    // Determine verdict type
    if (/true|accurate|correct/i.test(afterClaim)) {
      verdict = 'True';
      verdictClass = 'verdict-true';
    } else if (/false|inaccurate|incorrect|misleading/i.test(afterClaim)) {
      verdict = 'False';
      verdictClass = 'verdict-false';
    } else if (/partially|partly|somewhat/i.test(afterClaim)) {
      verdict = 'Partially True';
      verdictClass = 'verdict-partial';
    }
    
    // Extract explanation (text between verdict and next claim/end)
    const endOfVerdict = result.indexOf(verdict, match.index + match[0].length) + verdict.length;
    const nextClaimMatch = claimRegex.exec(result);
    claimRegex.lastIndex = match.index + match[0].length; // Reset regex position
    
    const explanationEndPos = nextClaimMatch ? nextClaimMatch.index : result.length;
    let explanation = result.slice(endOfVerdict, explanationEndPos).trim();
    explanation = explanation.replace(/^[.:,;]\s*/, ''); // Remove leading punctuation
    
    // Create HTML for this claim
    claimsHtml += `
      <div class="fact-claim">
        <div class="claim-text">"${claim}"</div>
        <div class="verdict ${verdictClass}">${verdict}</div>
        <div class="explanation">${explanation}</div>
      </div>
    `;
  }
  
  // If we successfully parsed claims, use the structured format
  if (claimsFound) {
    output += `<div class="structured-facts">${claimsHtml}</div>`;
  } else {
    // Otherwise, fall back to paragraph-based formatting
    const paragraphs = result.split('\n\n').filter(p => p.trim());
    
    const formatted = paragraphs.map(paragraph => {
      // Highlight "True" or "Fact: True" statements in green
      paragraph = paragraph.replace(
        /(Fact:|Statement:|Claim:)?\s*(True|Accurate|Correct)\b/gi, 
        '$1 <span class="true-statement">$2</span>'
      );
      
      // Highlight "False" or "Fact: False" statements in red
      paragraph = paragraph.replace(
        /(Fact:|Statement:|Claim:)?\s*(False|Inaccurate|Incorrect|Misleading)\b/gi, 
        '$1 <span class="false-statement">$2</span>'
      );
      
      // Highlight "Partially" statements in orange
      paragraph = paragraph.replace(
        /(Fact:|Statement:|Claim:)?\s*(Partially True|Partly True|Somewhat True)\b/gi, 
        '$1 <span class="partial-statement">$2</span>'
      );
      
      return `<p>${paragraph}</p>`;
    }).join('');
    
    output += formatted;
  }
  
  output += '</div>';
  return output;
}

// Add fact check button handler 
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

// FactLens Popup - Simple Direct Mode Implementation
// This version focuses on simplicity and reliability, avoiding complex OAuth flows

import firebaseService from "./firebase-service-v3.js";
import { authenticateWithTwitter, getTwitterTokens, TWITTER_CONFIG } from "./twitter-oauth-v2.js";
import DebugMode from "./debug-mode.js";

// Initialize when popup loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Show initial state
    document.getElementById("result").innerText = "Starting FactLens...";
    
    // Initialize debug mode
    const debugEnabled = DebugMode.init();
    console.log("Debug mode:", debugEnabled ? "enabled" : "disabled");
    
    // Initialize Firebase
    console.log("Initializing Firebase...");
    await firebaseService.initialize();
    
    // Check auth state
    checkAuthState();
    
    // Auto sign-in if debug mode enabled
    if (debugEnabled) {
      await DebugMode.autoSignInIfEnabled();
    }
  } catch (error) {
    console.error("Initialization error:", error);
    document.getElementById("result").innerHTML = `
      <div class="error-message">
        <p>Error initializing FactLens: ${error.message}</p>
      </div>
    `;
  }
});

// Check and update UI based on authentication state
function checkAuthState() {
  firebaseService.onAuthStateChanged((user) => {
    if (user) {
      // User is authenticated
      document.getElementById("signIn").style.display = "none";
      document.getElementById("signOut").style.display = "block";
      document.getElementById("factCheck").disabled = false;
      
      // Show user info
      const displayName = user.displayName || "X User";
      const photoURL = user.photoURL || "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png";
      
      document.getElementById("result").innerHTML = `
        <div class="user-info">
          <img src="${photoURL}" alt="Profile" class="profile-img">
          <span>Ready to fact-check as <b>${displayName}</b></span>
        </div>
      `;
      
      // Store auth status for debugging
      chrome.storage.local.set({
        'factlens_auth': {
          signedIn: true,
          uid: user.uid,
          displayName: displayName,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log("User authenticated:", displayName);
    } else {
      // Not authenticated
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

// Sign in with Twitter using direct token method
document.getElementById("signIn").addEventListener("click", async () => {
  try {
    // Update UI
    document.getElementById("signIn").disabled = true;
    document.getElementById("result").innerHTML = `
      <div class="auth-progress">
        <p>Authenticating with X...</p>
        <div class="loading-spinner small"></div>
      </div>
    `;
    
    console.log("Starting Twitter authentication");
    
    // Directly authenticate with provided Twitter tokens
    const authResponse = await authenticateWithTwitter();
    console.log("Twitter auth successful:", authResponse);
    
    // Get tokens (for Firebase auth)
    const tokens = await getTwitterTokens();
      // Use custom authentication instead of anonymous sign-in
    const customAuthHandler = (await import('./custom-auth.js')).default;
    await customAuthHandler.initialize();
    const mockUser = customAuthHandler.createMockUser();
    console.log("Custom authentication complete");
    
    // Update user profile with Twitter info
    await mockUser.updateProfile({
      displayName: "X User", 
      photoURL: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"
    });
    
    // Store credential info
    const credential = {
      providerId: "twitter.com",
      signInMethod: "direct-token",
      accessToken: tokens.accessToken
    };
    
    // Update Firebase service with mock user
    firebaseService.currentUser = mockUser;
    firebaseService.authStateListeners.forEach(listener => listener(mockUser));
    
    // Save user data
    await firebaseService.saveUserData(mockUser, credential);
    console.log("User data saved");
    
  } catch (error) {
    console.error("Authentication error:", error);
    
    // Show error message
    document.getElementById("result").innerHTML = `
      <div class="error-message">
        <p>Authentication error: ${error.message}</p>
        <p>Please try again or reload the extension.</p>
      </div>
    `;
    
    document.getElementById("signIn").disabled = false;
  }
});

// Handle sign out
document.getElementById("signOut").addEventListener("click", async () => {
  try {
    document.getElementById("result").innerText = "Signing out...";
    await firebaseService.signOut();
    // UI will update via auth state change
  } catch (error) {
    console.error("Sign-out error:", error);
    document.getElementById("result").innerText = `Error signing out: ${error.message}`;
  }
});

// Fact checking with Grok
document.getElementById("factCheck").addEventListener("click", async () => {
  // Ensure we're signed in
  const user = firebaseService.getCurrentUser();
  if (!user) {
    document.getElementById("result").innerText = "Please sign in first.";
    return;
  }
  
  // Update UI
  document.getElementById("result").innerText = "Extracting page content...";
  document.getElementById("loading").style.display = "block";
  document.getElementById("factCheck").disabled = true;
  
  try {
    // Get the active tab
    const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    
    if (!tabs || !tabs[0] || !tabs[0].id) {
      throw new Error("Could not identify current tab");
    }
    
    // Extract content from page
    const content = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabs[0].id, { message: "scrape_content" }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Content script not available. Try refreshing the page."));
          return;
        }
        
        if (!response || !response.text || response.text.trim() === "") {
          reject(new Error("No content found on page to fact-check."));
          return;
        }
        
        resolve(response.text);
      });
    });
    
    // Update status
    document.getElementById("result").innerText = "Connecting to Grok... (a new tab will open briefly)";
    
    // Truncate if too long
    const truncatedText = content.length > 5000 ? content.substring(0, 5000) : content;
    
    // Send fact check request to background script
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "factCheck", text: truncatedText }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    // Hide loading spinner
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    
    // Check for errors
    if (!response || !response.success) {
      throw new Error(response?.error || "Failed to get response from Grok");
    }
    
    // Display formatted results
    document.getElementById("result").innerHTML = formatGrokResult(response.result);
    
  } catch (error) {
    // Handle errors
    console.error("Fact-check error:", error);
    document.getElementById("loading").style.display = "none";
    document.getElementById("factCheck").disabled = false;
    document.getElementById("result").innerHTML = `
      <div class="error-message">
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
});

// Format Grok's response for better readability
function formatGrokResult(result) {
  if (!result) return "<p>No results were returned.</p>";

  // Clean up the result text
  result = result.trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*Grok:\s*/i, '');
  
  // Build formatted output
  let output = `<div class="fact-check-result">
    <div class="fact-check-header">
      <h3>Fact Check Results</h3>
      <div class="powered-by">Powered by Grok on X</div>
    </div>
    <div class="fact-check-content">`;
  
  // Look for claims pattern
  const claimRegex = /(?:Claim|Statement|Fact)\s*(?:\d+)?:\s*["']?(.+?)["']?(?=\s*(?:True|False|Accurate|Inaccurate|Misleading|Partially))/gi;
  let claimsFound = false;
  let match;
  let claimsHtml = '';
  
  // Reset regex state
  claimRegex.lastIndex = 0;
  
  // Extract claims and verdicts
  while ((match = claimRegex.exec(result)) !== null) {
    claimsFound = true;
    const claim = match[1].trim();
    const afterClaim = result.slice(match.index + match[0].length, match.index + match[0].length + 100);
    
    // Determine verdict
    let verdict = 'Unknown';
    let verdictClass = 'verdict-unknown';
    
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
    
    // Extract explanation
    const endOfVerdict = result.indexOf(verdict, match.index + match[0].length) + verdict.length;
    const nextClaimIndex = result.indexOf("Claim", endOfVerdict);
    const explanationEndPos = nextClaimIndex > 0 ? nextClaimIndex : result.length;
    let explanation = result.slice(endOfVerdict, explanationEndPos).trim();
    explanation = explanation.replace(/^[.:,;]\s*/, '');
    
    // Add to HTML
    claimsHtml += `
      <div class="fact-claim">
        <div class="claim-text">"${claim}"</div>
        <div class="verdict ${verdictClass}">${verdict}</div>
        <div class="explanation">${explanation}</div>
      </div>
    `;
    
    // Reset regex to continue from after this match
    claimRegex.lastIndex = match.index + match[0].length;
  }
  
  // Use structured format if claims found, otherwise format as paragraphs
  if (claimsFound) {
    output += claimsHtml;
  } else {
    // Format as paragraphs with highlighted verdicts
    const paragraphs = result.split('\n\n').filter(p => p.trim());
    
    paragraphs.forEach(paragraph => {
      // Highlight verdict words
      paragraph = paragraph
        .replace(/(Fact:|Statement:|Claim:)?\s*(True|Accurate|Correct)\b/gi, '$1 <span class="true-statement">$2</span>')
        .replace(/(Fact:|Statement:|Claim:)?\s*(False|Inaccurate|Incorrect|Misleading)\b/gi, '$1 <span class="false-statement">$2</span>')
        .replace(/(Fact:|Statement:|Claim:)?\s*(Partially True|Partly True|Somewhat True)\b/gi, '$1 <span class="partial-statement">$2</span>');
      
      output += `<p>${paragraph}</p>`;
    });
  }
  
  output += `</div></div>`;
  return output;
}

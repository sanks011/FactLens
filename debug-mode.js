// Debug mode utility for FactLens extension
// This provides alternative authentication options for testing

const DebugMode = {
  // Is debug mode enabled
  enabled: true,
  
  // Debug options
  options: {
    // Skip OAuth and use direct tokens
    skipOAuth: true,
    
    // Always sign in automatically
    autoSignIn: true,
    
    // Show debug info in UI
    showDebugInfo: true
  },
  
  // Initialize debug mode
  init() {
    console.log("FactLens Debug Mode initialized");
    if (this.enabled && this.options.showDebugInfo) {
      this.injectDebugUI();
    }
    
    // Store debug status in storage
    chrome.storage.local.set({
      'factlens_debug': {
        enabled: this.enabled,
        options: this.options,
        timestamp: new Date().toISOString()
      }
    });
    
    return this.enabled;
  },
  
  // Add debug UI elements to the popup
  injectDebugUI() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this._createDebugElements());
    } else {
      this._createDebugElements();
    }
  },
    // Create debug UI elements
  _createDebugElements() {
    // Only in popup context
    if (!document.querySelector(".container")) return;
    
    // Create debug panel
    const debugPanel = document.createElement("div");
    debugPanel.className = "debug-panel";
    debugPanel.innerHTML = `
      <div class="debug-header">Debug Mode Active</div>
      <div class="debug-options">
        <div>Direct Auth: <span class="highlight">Enabled</span></div>
        <div>Auto Sign-In: <span class="highlight">${this.options.autoSignIn ? 'Enabled' : 'Disabled'}</span></div>
      </div>
      <button id="debug-signin" class="debug-button">Force Sign-In</button>
      <button id="debug-reset" class="debug-button">Reset Auth State</button>
      <button id="debug-check-tokens" class="debug-button">Check Tokens</button>
      <div id="debug-status" class="debug-status"></div>
    `;
    
    // Add to DOM
    document.querySelector(".container").appendChild(debugPanel);
    
    // Add styles
    const style = document.createElement("style");
    style.textContent = `
      .debug-panel {
        margin-top: 20px;
        padding: 10px;
        border: 1px dashed #ff5500;
        background: #fff3e0;
        border-radius: 6px;
        font-size: 12px;
      }
      .debug-header {
        font-weight: bold;
        color: #ff5500;
        margin-bottom: 5px;
      }
      .debug-options {
        margin-bottom: 10px;
      }
      .highlight {
        font-weight: bold;
      }
      .debug-button {
        background: #ff7700;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        margin-right: 8px;
        margin-bottom: 5px;
        cursor: pointer;
        font-size: 12px;
      }
      .debug-status {
        margin-top: 8px;
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
    
    // Add event listeners
    document.getElementById("debug-signin").addEventListener("click", () => {
      this.forceSignIn();
    });
      document.getElementById("debug-reset").addEventListener("click", () => {
      this.resetAuthState();
    });
    
    document.getElementById("debug-check-tokens").addEventListener("click", () => {
      this.checkTokenStatus();
    });
  },
    // Force sign-in for testing
  async forceSignIn() {
    try {
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = "Forcing authentication...";
      }
      
      // Import necessary modules
      const firebaseServiceModule = await import("./firebase-service-v3.js");
      const twitterAuthModule = await import("./twitter-oauth-v2.js");
      const customAuthModule = await import("./custom-auth.js");
      
      const firebaseService = firebaseServiceModule.default;
      const customAuthHandler = customAuthModule.default;
      const { getTwitterTokens } = twitterAuthModule;
      
      // Initialize Firebase if needed
      if (!firebaseService.initialized) {
        await firebaseService.initialize();
      }
      
      // Get Twitter tokens
      const tokens = await getTwitterTokens();
      console.log("Debug: Got Twitter tokens", tokens);
      
      // Use custom authentication instead of anonymous sign-in
      console.log("Debug: Using custom authentication");
      await customAuthHandler.initialize();
      const mockUser = customAuthHandler.createMockUser();
      console.log("Debug: Created mock user", mockUser);
      
      // Update mock user profile
      await mockUser.updateProfile({
        displayName: "X User (Debug Mode)",
        photoURL: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png"
      });
      
      // Simulate Firebase Auth state change
      firebaseService.currentUser = mockUser;
      firebaseService.authStateListeners.forEach(listener => listener(mockUser));
      
      // Save to DB
      await firebaseService.saveUserData(mockUser, {
        providerId: "twitter.com",
        signInMethod: "debug-mode",
        accessToken: tokens.accessToken
      });
      
      if (statusElement) {
        statusElement.textContent = "Debug sign-in complete!";
      }
    } catch (error) {
      console.error("Debug sign-in error:", error);
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = `Error: ${error.message}`;
      }
    }
  },
  
  // Reset authentication state
  async resetAuthState() {
    try {
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = "Resetting auth state...";
      }
      
      // Clear storage
      await new Promise(resolve => {
        chrome.storage.local.clear(resolve);
      });
      
      // Sign out if Firebase is available
      try {
        const firebaseServiceModule = await import("./firebase-service-v3.js");
        const firebaseService = firebaseServiceModule.default;
        await firebaseService.signOut();
      } catch (e) {
        console.log("Firebase not initialized yet");
      }
      
      if (statusElement) {
        statusElement.textContent = "Auth state reset. Reload the extension.";
      }
    } catch (error) {
      console.error("Reset error:", error);
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = `Error: ${error.message}`;
      }
    }
  },
    // Auto sign-in if enabled
  async autoSignInIfEnabled() {
    if (this.enabled && this.options.autoSignIn) {
      console.log("Debug: Auto sign-in triggered");
      setTimeout(() => this.forceSignIn(), 1000);
      return true;
    }
    return false;
  },
  
  // Check token status in storage
  async checkTokenStatus() {
    try {
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = "Checking auth tokens...";
      }
      
      // Import debug utils
      const { checkTwitterTokens } = await import("./debug-utils.js");
      
      // Check tokens
      const tokenInfo = await checkTwitterTokens();
      console.log("Token status:", tokenInfo);
      
      if (statusElement) {
        statusElement.innerHTML = `
          <div style="font-size:12px; margin-top:10px; text-align:left; overflow:auto; max-height:150px;">
            <div><b>Individual Keys:</b> ${tokenInfo.individualKeys.accessToken}, ${tokenInfo.individualKeys.secretToken}</div>
            <div><b>Object Format:</b> ${typeof tokenInfo.objectFormat === 'string' ? tokenInfo.objectFormat : 
              `${tokenInfo.objectFormat.accessToken}, ${tokenInfo.objectFormat.secretToken}`}</div>
            <div><b>Auth State:</b> ${tokenInfo.authState.signedIn ? 'Signed In' : 'Not Signed In'}</div>
          </div>
          <button id="debug-fix-tokens" class="debug-button" style="margin-top:8px;">Fix Tokens</button>
        `;
        
        // Add event listener to fix tokens button
        document.getElementById("debug-fix-tokens")?.addEventListener("click", async () => {
          const { forceSetTwitterTokens } = await import("./debug-utils.js");
          const { TWITTER_CONFIG } = await import("./twitter-oauth-v2.js");
          
          await forceSetTwitterTokens(TWITTER_CONFIG);
          statusElement.textContent = "Tokens fixed! Try fact-checking now.";
        });
      }
    } catch (error) {
      console.error("Token status check error:", error);
      const statusElement = document.getElementById("debug-status");
      if (statusElement) {
        statusElement.textContent = `Error: ${error.message}`;
      }
    }
  }
};

export default DebugMode;

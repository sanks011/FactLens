// Grok Interaction Service for FactLens
// This service handles the interaction with Grok AI on x.com/i/grok using the user's X account session

class GrokService {
  constructor() {
    this.isInitialized = false;
    this.isWorking = false;
    this.statusListeners = [];
  }

  // Initialize the service
  initialize() {
    if (this.isInitialized) return;
    
    console.log("Initializing Grok service");
    // Set up message listeners for background communication
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "factCheck") {
        this.factCheck(message.text)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
      }
    });
    
    this.isInitialized = true;
  }
  
  // Run a fact check using Grok
  async factCheck(text) {
    if (this.isWorking) {
      throw new Error("Another fact-check is already in progress");
    }
    
    if (!text || typeof text !== 'string' || text.trim() === '') {
      throw new Error("No valid content to fact-check");
    }
    
    console.log(`Starting fact-check of ${text.length} characters`);
    this._updateStatus("starting");
    this.isWorking = true;
    
    try {
      // Get stored Twitter tokens for authentication
      const twitterTokens = await this._getStoredTwitterTokens();
      if (!twitterTokens) {
        throw new Error("Twitter authentication required. Please sign in.");
      }
      
      console.log("Using Twitter tokens for Grok authentication");
      
      // Use Twitter tokens to authenticate with Grok
      const factCheckResult = await this._interactWithGrok(text, twitterTokens);
      this._updateStatus("completed");
      this.isWorking = false;
      return factCheckResult;
    } catch (error) {
      this._updateStatus("error");
      this.isWorking = false;
      console.error("Fact-check error:", error);
      throw error;
    }
  }
  
  // Get Twitter tokens from storage - checks both separate keys and object format
  async _getStoredTwitterTokens() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'twitter_access_token',
        'twitter_access_token_secret',
        'twitter_bearer_token',
        'twitter_tokens'
      ], (result) => {
        // First check individual keys
        if (
          result.twitter_access_token &&
          result.twitter_access_token_secret &&
          result.twitter_bearer_token
        ) {
          console.log("Found Twitter tokens as individual keys");
          resolve({
            accessToken: result.twitter_access_token,
            accessTokenSecret: result.twitter_access_token_secret,
            bearerToken: result.twitter_bearer_token
          });
        } 
        // Then check if tokens are stored as an object
        else if (result.twitter_tokens && 
                result.twitter_tokens.accessToken && 
                result.twitter_tokens.accessTokenSecret &&
                result.twitter_tokens.bearerToken) {
          console.log("Found Twitter tokens as object");
          resolve({
            accessToken: result.twitter_tokens.accessToken,
            accessTokenSecret: result.twitter_tokens.accessTokenSecret,
            bearerToken: result.twitter_tokens.bearerToken
          });
        } 
        // No tokens found
        else {
          console.log("No Twitter tokens found in storage");
          resolve(null);
        }
      });
    });
  }
  
  // Private method to interact with Grok via a new tab
  async _interactWithGrok(text, twitterTokens) {
    // Create a new tab to interact with Grok
    return new Promise((resolve, reject) => {
      // Format the prompt for fact-checking
      const prompt = this._formatFactCheckPrompt(text);
      
      // To share variables between content script and this scope
      const responseData = {
        result: null,
        error: null,
        completed: false
      };
      
      // Store Twitter tokens to be used by content script
      if (twitterTokens) {
        chrome.storage.local.set({
          'grok_auth_tokens': {
            accessToken: twitterTokens.accessToken,
            accessTokenSecret: twitterTokens.accessTokenSecret,
            bearerToken: twitterTokens.bearerToken
          }
        });
      }
      
      // Open a new Grok tab - now using visible tab and direct x.com/i/grok URL
      chrome.tabs.create(
        { url: "https://x.com/i/grok", active: true }, // Make tab visible and go directly to Grok
        (tab) => {
          if (!tab || !tab.id) {
            reject(new Error("Could not create Grok tab"));
            return;
          }

          // Store the tab ID for later
          const grokTabId = tab.id;
          console.log("Created Grok tab with ID:", grokTabId);
          
          // Check if tab exists before using it
          const checkTabExists = async (tabId) => {
            try {
              return new Promise(resolve => {
                chrome.tabs.get(tabId, tab => {
                  const exists = !chrome.runtime.lastError && tab;
                  resolve(exists);
                });
              });
            } catch (e) {
              console.error("Error checking tab:", e);
              return false;
            }
          };
          
          // Wait for tab to load then inject our script
          const tabLoadListener = function(tabId, changeInfo) {
            if (tabId === grokTabId && changeInfo.status === 'complete') {
              // Remove the listener first to prevent multiple calls
              chrome.tabs.onUpdated.removeListener(tabLoadListener);
              
              // Check if tab still exists
              checkTabExists(grokTabId).then(exists => {
                if (!exists) {
                  console.error("Tab no longer exists");
                  reject(new Error("Grok tab was closed before script could be injected"));
                  return;
                }
                
                // Wait a bit for page to stabilize
                setTimeout(() => {
                  // Inject our script to interact with Grok
                  chrome.scripting.executeScript({
                    target: { tabId: grokTabId },
                    files: ['grok-inject.js']
                  }).then(() => {
                    console.log("Grok injection script executed");
                  }).catch(error => {
                    console.error("Error injecting script:", error);
                    responseData.error = "Failed to inject script: " + error.message;
                    responseData.completed = true;
                    
                    // Only try to close the tab if it still exists
                    checkTabExists(grokTabId).then(exists => {
                      if (exists) {
                        try {
                          chrome.tabs.remove(grokTabId);
                        } catch (e) {
                          console.error("Error closing tab:", e);
                        }
                      }
                      reject(new Error("Failed to inject script: " + error.message));
                    });
                  });
                }, 1000); // Wait 1 second for page to stabilize
              });
            }
          };
          
          // Register the tab load listener
          chrome.tabs.onUpdated.addListener(tabLoadListener);
          
          // Set up a listener for content script messages
          const messageListener = (message, sender, sendResponse) => {
            // Check if the message is from our tab and has the right format
            if (message.from === "grok-content-script") {
              console.log("Received message from content script:", message);
              
              // Check if the tab still exists
              checkTabExists(grokTabId).then(exists => {
                const senderTabId = sender.tab && sender.tab.id;
                
                // Only process messages from our tab or if our tab doesn't exist anymore
                if (!exists || senderTabId === grokTabId) {
                  if (message.type === "ready") {
                    // Script is ready, check if tab still exists
                    if (exists) {
                      // Send the fact-check request
                      chrome.tabs.sendMessage(grokTabId, {
                        action: "perform-fact-check",
                        text: prompt
                      }).catch(err => {
                        console.error("Error sending message to tab:", err);
                      });
                    }
                    return true;
                  }
                  
                  if (message.type === "fact-check-result") {
                    responseData.result = message.result;
                    responseData.completed = true;
                    
                    // Close the Grok tab if it still exists
                    if (exists) {
                      chrome.tabs.remove(grokTabId).catch(() => {});
                    }
                    
                    // Resolve with the result
                    resolve(responseData.result);
                    return true;
                  }
                  
                  if (message.type === "fact-check-error") {
                    responseData.error = message.error;
                    responseData.completed = true;
                    
                    // Close the Grok tab if it still exists
                    if (exists) {
                      chrome.tabs.remove(grokTabId).catch(() => {});
                    }
                    
                    // Reject with the error
                    reject(new Error(message.error));
                    return true;
                  }
                }
              });
            }
            return false;
          };
          
          // Register the message listener
          chrome.runtime.onMessage.addListener(messageListener);
          
          // Set a timeout to prevent hanging if the interaction takes too long
          setTimeout(() => {
            if (!responseData.completed) {
              console.error("Fact-check timed out");
              // Check if tab still exists
              checkTabExists(grokTabId).then(exists => {
                if (exists) {
                  chrome.tabs.remove(grokTabId).catch(() => {});
                }
                reject(new Error("Fact-check took too long and timed out"));
              });
            }
          }, 60000); // 1 minute timeout
        }
      );
    });
  }
  
  // Format the prompt for fact-checking
  _formatFactCheckPrompt(text) {
    // Truncate text if it's too long
    const truncatedText = text.length > 5000 ? `${text.substring(0, 5000)}... (truncated)` : text;
    
    return `Please fact check the following content and tell me which statements are accurate and which ones are not. Provide evidence for your answers.
    
Content to fact check:
"""
${truncatedText}
"""

Please provide your fact check in a structured way, listing each major claim and your assessment.`;
  }
  
  // Update status and notify listeners
  _updateStatus(status) {
    this.status = status;
    this.statusListeners.forEach(listener => listener(status));
  }
  
  // Add a status listener
  addStatusListener(callback) {
    this.statusListeners.push(callback);
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }
}

// Create a singleton instance
const grokService = new GrokService();
export default grokService;

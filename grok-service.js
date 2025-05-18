// Grok Interaction Service for FactLens
// This service handles the interaction with Grok AI on grok.com using the user's X account session

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
  
  // Get Twitter tokens from storage
  async _getStoredTwitterTokens() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'twitter_access_token',
        'twitter_access_token_secret',
        'twitter_bearer_token'
      ], (result) => {
        if (
          result.twitter_access_token &&
          result.twitter_access_token_secret &&
          result.twitter_bearer_token
        ) {
          resolve({
            accessToken: result.twitter_access_token,
            accessTokenSecret: result.twitter_access_token_secret,
            bearerToken: result.twitter_bearer_token
          });
        } else {
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
      }      // Open a new Grok tab
      chrome.tabs.create(
        { url: "https://grok.x.com", active: false },
        (tab) => {
          // Store the tab ID for later
          const grokTabId = tab.id;
          
          // Wait for tab to load then inject our script
          chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === grokTabId && changeInfo.status === 'complete') {
              // Remove the listener
              chrome.tabs.onUpdated.removeListener(listener);
              
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
                chrome.tabs.remove(grokTabId);
                reject(new Error("Failed to inject script: " + error.message));
              });
            }
          });
          
          // Set up a listener for content script messages
          const messageListener = (message, sender, sendResponse) => {
            if (sender.tab && sender.tab.id === grokTabId && message.from === "grok-content-script") {
              console.log("Received message from content script:", message);
              
              if (message.type === "ready") {
                // Script is ready, send the fact-check request
                chrome.tabs.sendMessage(grokTabId, {
                  action: "perform-fact-check",
                  text: prompt
                });
                return true;
              }
              
              if (message.type === "fact-check-result") {
                responseData.result = message.result;
                responseData.completed = true;
                
                // Close the Grok tab
                chrome.tabs.remove(grokTabId);
                
                // Resolve with the result
                resolve(responseData.result);
                return true;
              }
              
              if (message.type === "fact-check-error") {
                responseData.error = message.error;
                responseData.completed = true;
                
                // Close the Grok tab
                chrome.tabs.remove(grokTabId);
                
                // Reject with the error
                reject(new Error(message.error));
                return true;
              }
            }
            return false;
          };
          
          // Register the message listener
          chrome.runtime.onMessage.addListener(messageListener);
          
          // Set up a tab update listener to detect when the page is loaded
          const tabUpdateListener = (tabId, changeInfo, updatedTab) => {
            if (tabId === grokTabId && changeInfo.status === "complete") {
              console.log("Grok tab loaded, injecting content script");
              
              // Small delay to ensure page is fully loaded
              setTimeout(() => {
                // Execute a content script to interact with Grok
                chrome.scripting.executeScript(
                  {
                    target: { tabId: grokTabId },
                    function: this._grokContentScript,
                    args: [prompt]
                  },
                  (results) => {
                    // Log any errors
                    if (chrome.runtime.lastError) {
                      console.error("Script injection error:", chrome.runtime.lastError);
                      reject(new Error("Could not inject script into Grok page"));
                      chrome.tabs.remove(grokTabId);
                    }
                  }
                );
              }, 2000);
              
              // Remove the listener
              chrome.tabs.onUpdated.removeListener(tabUpdateListener);
            }
          };
          
          // Register the tab update listener
          chrome.tabs.onUpdated.addListener(tabUpdateListener);
          
          // Set a timeout to prevent hanging if the interaction takes too long
          setTimeout(() => {
            if (!responseData.completed) {
              console.error("Fact-check timed out");
              chrome.tabs.remove(grokTabId);
              reject(new Error("Fact-check took too long and timed out"));
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
    // This function will be injected as a content script into the Grok page
  _grokContentScript(prompt) {
    console.log("Grok content script injected");
    
    // Function to send a message back to the extension
    function sendMessageToExtension(type, data) {
      chrome.runtime.sendMessage({
        from: "grok-content-script",
        type: type,
        ...data
      });
    }
    
    // Wait for the page to be ready with better error handling
    function waitForElement(selector, timeout = 30000) {
      return new Promise((resolve, reject) => {
        // Check if element already exists
        const existingElement = document.querySelector(selector);
        if (existingElement) {
          console.log(`Element found immediately: ${selector}`);
          return resolve(existingElement);
        }
        
        console.log(`Waiting for element: ${selector}`);
        
        // Set up observer for dynamic content
        const observer = new MutationObserver((mutations) => {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Element found after waiting: ${selector}`);
            observer.disconnect();
            resolve(element);
          }
        });
        
        // Start observing with deep tree observation
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true
        });
        
        // Set timeout to avoid hanging indefinitely
        setTimeout(() => {
          observer.disconnect();
          // Try one last time before rejecting
          const lastChanceElement = document.querySelector(selector);
          if (lastChanceElement) {
            console.log(`Element found at last chance: ${selector}`);
            resolve(lastChanceElement);
          } else {
            console.error(`Timeout waiting for element: ${selector}`);
            reject(new Error(`Timeout waiting for element: ${selector}`));
          }
        }, timeout);
      });
    }
    
    // Enhanced login status check with more selectors
    function checkLoginStatus() {
      console.log("Checking login status for X/Grok");
      
      // Multiple possible selectors that indicate not logged in
      const loginSelectors = [
        '[data-testid="loginButton"]',
        '[data-testid="login"]',
        '[data-testid="signIn"]',
        '.login-button',
        '.signin-btn'
      ];
      
      // Check each selector
      for (const selector of loginSelectors) {
        if (document.querySelector(selector)) {
          console.error(`Found login indicator: ${selector}`);
          sendMessageToExtension("fact-check-error", {
            error: "You need to be logged into X or Grok to use this feature. Please sign in first."
          });
          return false;
        }
      }
      
      // Check if we can find user-specific elements that indicate being logged in
      const loggedInSelectors = [
        '[data-testid="userAvatar"]',
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '.user-avatar'
      ];
      
      for (const selector of loggedInSelectors) {
        if (document.querySelector(selector)) {
          console.log(`Found logged-in indicator: ${selector}`);
          return true;
        }
      }
      
      // If we can't definitively tell, assume logged in and try anyway
      console.log("Login status uncertain, proceeding with attempt");
      return true;
    }
      // Enhanced function to interact with Grok
    async function interactWithGrok() {
      try {
        console.log("Waiting for Grok interface to load");
        
        // First check if we're on Grok or need to navigate there
        if (!window.location.href.includes('grok.x.com')) {
          console.log("Not on Grok page, attempting to navigate");
          sendMessageToExtension("fact-check-error", {
            error: "Not on Grok page. Please use https://grok.x.com"
          });
          return;
        }
        
        // Try multiple selectors for the input box
        let inputBox = null;
        const inputSelectors = [
          '[data-testid="tweetTextarea"]', 
          'textarea[placeholder*="Ask"]',
          '.grok-input',
          'div[role="textbox"]',
          'textarea'
        ];
        
        for (const selector of inputSelectors) {
          try {
            console.log(`Looking for input box with selector: ${selector}`);
            inputBox = await waitForElement(selector, 10000);  // shorter timeout for each selector
            if (inputBox) {
              console.log(`Found input box with selector: ${selector}`);
              break;
            }
          } catch (e) {
            console.log(`Selector ${selector} not found, trying next`);
          }
        }
        
        if (!inputBox) {
          throw new Error("Could not find Grok input box. Interface might have changed.");
        }
        
        // Focus the input box
        inputBox.focus();
        console.log("Input box focused");
        
        // Try different methods to set input text
        try {
          // Method 1: Using execCommand
          document.execCommand('insertText', false, prompt);
          console.log("Text inserted using execCommand");
        } catch (e) {
          console.warn("execCommand failed, trying alternative method", e);
          
          // Method 2: Setting value directly
          if ('value' in inputBox) {
            inputBox.value = prompt;
            console.log("Text inserted by setting value");
            
            // Trigger input event to ensure Grok recognizes the change
            const event = new Event('input', { bubbles: true });
            inputBox.dispatchEvent(event);
          } else {
            // Method 3: Simulate typing (last resort)
            console.log("Simulating typing");
            inputBox.textContent = prompt;
          }
        }
        
        // Wait for input to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try multiple selectors for submit button
        let submitButton = null;
        const submitSelectors = [
          '[data-testid="tweetButton"]',
          'button[aria-label*="Send"]',
          'button.send-button',
          'button:has(svg)',
          'button.grok-submit-button'
        ];
        
        for (const selector of submitSelectors) {
          try {
            submitButton = await waitForElement(selector, 5000);
            if (submitButton) {
              console.log(`Found submit button with selector: ${selector}`);
              break;
            }
          } catch (e) {
            console.log(`Submit button selector ${selector} not found, trying next`);
          }
        }
        
        if (!submitButton) {
          throw new Error("Could not find submit button. Interface might have changed.");
        }
        
        // Click the submit button
        console.log("Clicking submit button");
        submitButton.click();
        
        // Wait for response with multiple selectors
        console.log("Waiting for Grok to respond");
        let responseElement = null;
        const responseSelectors = [
          '[data-testid="grokResponse"]',
          '.grok-response',
          '.response-container',
          'article[role="article"]',
          'div[dir="auto"]'
        ];
        
        for (const selector of responseSelectors) {
          try {
            responseElement = await waitForElement(selector, 20000);
            if (responseElement) {
              console.log(`Found response with selector: ${selector}`);
              break;
            }
          } catch (e) {
            console.log(`Response selector ${selector} not found, trying next`);
          }
        }
        
        if (!responseElement) {
          throw new Error("Could not find Grok's response. Interface might have changed or Grok didn't respond.");
        }
        
        // Wait for the response to finish generating
        console.log("Waiting for complete response");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Get the response text with fallbacks
        let responseText;
        if (responseElement.textContent) {
          responseText = responseElement.textContent;
        } else {
          responseText = responseElement.innerText || document.body.innerText;
        }
        
        console.log("Got response from Grok");
        
        // Format the response for better readability
        const formattedResponse = responseText
          .replace(/(\r\n|\n|\r)/gm, "\n") // Normalize line breaks
          .replace(/\s+/g, " ") // Remove extra spaces
          .trim();
          
        // Send the response back to the extension
        sendMessageToExtension("fact-check-result", {
          result: formattedResponse
        });
      } catch (error) {
        console.error("Error interacting with Grok:", error);
        sendMessageToExtension("fact-check-error", {
          error: error.message || "Unknown error while interacting with Grok"
        });
      }
    }
    
    // Check login and proceed
    if (checkLoginStatus()) {
      interactWithGrok();
    }
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

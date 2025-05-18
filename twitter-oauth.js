// Twitter Authentication Handler for FactLens
// DIRECT MODE: Using pre-authorized tokens for Grok access

// Twitter API configuration with direct tokens
const TWITTER_CONFIG = {
  clientId: "TldJdTg5bnFoMUl3akEya0pSQlM6MTpjaQ", // Client ID
  clientSecret: "EawCtb3FopazjiABJYqxlGbzrMGrrLYr1lMZcgPQ6FzI3e0hJq", // Client Secret
  accessToken: "1751231537427996673-OXiw1i79YGSu0lSG9fXLlEkUUakyBw", // Access Token
  accessTokenSecret: "sYhYFZz2bteNGCWuSKbupbhcord5eWLMZdBut8DJJIUmV", // Access Token Secret
  bearerToken: "AAAAAAAAAAAAAAAAAAAAABo%2B1wEAAAAA%2BhggN9CFv7MJ1PMBhPhr%2BR0G1o0%3DlkiEJtZvCHDEj6i8knTzzQJ0lBc8wJrJjfHOZOnYk1DvBbqFpE" // Bearer Token
};

/**
 * Authentication method - DIRECT MODE
 * This skips the traditional OAuth flow and uses the provided tokens directly
 * For a production app, you'd use proper OAuth flow with a backend
 */
async function authenticateWithTwitter() {
  console.log("Starting Twitter Direct Authentication");
  
  // Create simpler auth process without redirects
  return new Promise((resolve) => {
    console.log("Using pre-configured tokens for authentication");
    
    // Directly use the provided access tokens
    const mockAuthResponse = {
      code: "direct-auth-" + Math.random().toString(36).substring(2, 10),
      redirectUri: null,
      codeVerifier: null,
      // Add the tokens directly
      accessToken: TWITTER_CONFIG.accessToken,
      accessTokenSecret: TWITTER_CONFIG.accessTokenSecret,
      bearerToken: TWITTER_CONFIG.bearerToken
    };
    
    // Store tokens in Chrome storage for Grok access
    chrome.storage.local.set({
      'twitter_tokens': {
        accessToken: TWITTER_CONFIG.accessToken,
        accessTokenSecret: TWITTER_CONFIG.accessTokenSecret,
        bearerToken: TWITTER_CONFIG.bearerToken,
        tokenType: 'bearer',
        expiresAt: Date.now() + (7200 * 1000) // 2 hours from now
      }
    }, () => {
      console.log("Tokens stored successfully");
      
      // Simulate successful auth
      resolve(mockAuthResponse);
    });  });
}

/**
 * Get tokens - no need to exchange code anymore, we already have them
 */
async function getTwitterTokens() {
  console.log("Getting Twitter tokens (direct mode)");
  
  // Simply return the pre-configured tokens
  return {
    accessToken: TWITTER_CONFIG.accessToken,
    accessTokenSecret: TWITTER_CONFIG.accessTokenSecret,
    bearerToken: TWITTER_CONFIG.bearerToken,
    tokenType: 'bearer',
    expiresIn: 7200
  };
        
      console.log("Launching auth flow with URL:", authUrl);
      
      // Launch the Twitter auth flow
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, (responseUrl) => {
        // Handle errors from chrome.identity
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.error("Chrome Identity Error:", errorMsg);
          
          // Provide better error messages based on the response
          if (errorMsg.includes("canceled")) {
            reject(new Error("Authentication was canceled by the user"));
          } else if (errorMsg.includes("not registered")) {
            reject(new Error(`The redirect URL is not registered in Twitter Developer Portal. Please register exactly: ${redirectURL}`));
          } else {
            reject(new Error(`Chrome Identity Error: ${errorMsg}`));
          }
          return;
        }
        
        if (!responseUrl) {
          reject(new Error("No response URL returned from authentication"));
          return;
        }
        
        try {
          console.log("Response URL received:", responseUrl);
          
          // Parse the response URL
          const url = new URL(responseUrl);
          
          // Check for errors
          if (url.searchParams.has("error")) {
            const error = url.searchParams.get("error");
            const description = url.searchParams.get("error_description") || "Unknown error";
            throw new Error(`Twitter OAuth error: ${error} - ${description}`);
          }
          
          // Verify state parameter to prevent CSRF
          const returnedState = url.searchParams.get("state");
          if (returnedState !== state) {
            throw new Error("OAuth state mismatch - possible security issue");
          }
          
          // Extract the authorization code
          const code = url.searchParams.get("code");
          if (!code) {
            throw new Error("No authorization code in response");
          }
          
          console.log("Auth code received:", code.substring(0, 5) + "...");
          
          // In a real implementation, you would exchange this code for tokens
          // For this demo, we'll just return the code
          resolve({
            code: code,
            redirectUri: redirectURL,
            codeVerifier: codeVerifier
          });
        } catch (error) {
          console.error("Error processing OAuth response:", error);
          reject(error);
        }
      });
    } catch (error) {
      console.error("Twitter authentication error:", error);
      reject(error);
    }
  });
}

// Function to exchange the authorization code for tokens
async function getTwitterTokens(authResponse) {
  console.log("Exchanging authorization code for tokens");
  
  try {
    // For security reasons, we should exchange the token on a secure server
    // But for our extension that isn't possible, so we'll use the token directly
    
    // Create form data for token exchange
    const tokenRequestData = new URLSearchParams();
    tokenRequestData.append('code', authResponse.code);
    tokenRequestData.append('grant_type', 'authorization_code');
    tokenRequestData.append('client_id', TWITTER_CONFIG.clientId);
    tokenRequestData.append('redirect_uri', authResponse.redirectUri);
    tokenRequestData.append('code_verifier', authResponse.codeVerifier);
    
    // Use the existing access tokens rather than making a real OAuth exchange
    // This avoids the need for client_secret which shouldn't be in client code
    return {
      accessToken: TWITTER_CONFIG.accessToken,
      accessTokenSecret: TWITTER_CONFIG.accessTokenSecret,
      bearerToken: TWITTER_CONFIG.bearerToken,
      expiresIn: 7200
    };
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    throw new Error("Failed to get Twitter access tokens: " + error.message);
  }
}

// Export functions for use in other modules
export {
  authenticateWithTwitter,
  getTwitterTokens,
  TWITTER_CONFIG
};

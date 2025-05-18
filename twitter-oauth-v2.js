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
      // Store tokens in Chrome storage for Grok access - using individual keys
    chrome.storage.local.set({
      'twitter_tokens': {
        accessToken: TWITTER_CONFIG.accessToken,
        accessTokenSecret: TWITTER_CONFIG.accessTokenSecret,
        bearerToken: TWITTER_CONFIG.bearerToken,
        tokenType: 'bearer',
        expiresAt: Date.now() + (7200 * 1000) // 2 hours from now
      },
      // Also store separate keys for grok-service.js compatibility
      'twitter_access_token': TWITTER_CONFIG.accessToken,
      'twitter_access_token_secret': TWITTER_CONFIG.accessTokenSecret,
      'twitter_bearer_token': TWITTER_CONFIG.bearerToken
    }, () => {
      console.log("Tokens stored successfully");
      
      // Simulate successful auth
      resolve(mockAuthResponse);
    });
  });
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
}

// Export functions for use in other modules
export {
  authenticateWithTwitter,
  getTwitterTokens,
  TWITTER_CONFIG
};

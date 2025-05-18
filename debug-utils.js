// Debug utilities for FactLens extension
// This file helps with troubleshooting auth tokens and storage

// Check if Twitter tokens are properly stored
async function checkTwitterTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (result) => {
      const tokenInfo = {
        individualKeys: {
          accessToken: !!result.twitter_access_token ? "Present" : "Missing",
          secretToken: !!result.twitter_access_token_secret ? "Present" : "Missing",
          bearerToken: !!result.twitter_bearer_token ? "Present" : "Missing"
        },
        objectFormat: !!result.twitter_tokens ? {
          accessToken: !!result.twitter_tokens?.accessToken ? "Present" : "Missing",
          secretToken: !!result.twitter_tokens?.accessTokenSecret ? "Present" : "Missing",
          bearerToken: !!result.twitter_tokens?.bearerToken ? "Present" : "Missing",
          expiresAt: result.twitter_tokens?.expiresAt ? new Date(result.twitter_tokens.expiresAt).toLocaleString() : "Missing"
        } : "Missing",
        authState: {
          signedIn: !!result.factlens_auth?.signedIn,
          uid: result.factlens_auth?.uid || "None",
          timestamp: result.factlens_auth?.timestamp || "None"
        },
        debugMode: {
          enabled: !!result.factlens_debug?.enabled,
          autoSignIn: !!result.factlens_debug?.options?.autoSignIn
        },
        customUserId: result.factlens_user_id || "None"
      };
      
      resolve(tokenInfo);
    });
  });
}

// Reset all tokens and auth state
async function resetAllTokens() {
  return new Promise((resolve) => {
    const keysToRemove = [
      'twitter_access_token',
      'twitter_access_token_secret',
      'twitter_bearer_token',
      'twitter_tokens',
      'factlens_auth',
      'factlens_debug'
    ];
    
    chrome.storage.local.remove(keysToRemove, () => {
      resolve({
        success: true,
        message: "All tokens and auth state reset"
      });
    });
  });
}

// Force set proper Twitter tokens
async function forceSetTwitterTokens(config) {
  return new Promise((resolve) => {
    const tokensToSet = {
      'twitter_access_token': config.accessToken,
      'twitter_access_token_secret': config.accessTokenSecret,
      'twitter_bearer_token': config.bearerToken,
      'twitter_tokens': {
        accessToken: config.accessToken,
        accessTokenSecret: config.accessTokenSecret,
        bearerToken: config.bearerToken,
        tokenType: 'bearer',
        expiresAt: Date.now() + (7200 * 1000) // 2 hours from now
      }
    };
    
    chrome.storage.local.set(tokensToSet, () => {
      resolve({
        success: true,
        message: "Twitter tokens forcefully set"
      });
    });
  });
}

// Add debug functions to global window object if in popup context
if (typeof window !== 'undefined') {
  window.factLensDebug = {
    checkTwitterTokens,
    resetAllTokens,
    forceSetTwitterTokens,
    // Import config for easy access
    async importConfig() {
      const module = await import('./twitter-oauth-v2.js');
      return module.TWITTER_CONFIG;
    }
  };
  
  console.log("FactLens Debug Utils loaded. Access via window.factLensDebug");
}

export {
  checkTwitterTokens,
  resetAllTokens,
  forceSetTwitterTokens
};

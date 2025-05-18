// FactLens Test Script
// Run this from the browser console on the extension popup page

async function testFactLensAuth() {
  console.log("FactLens Test: Starting authentication test");
  
  try {
    // Try to import the modules
    const { default: debugMode } = await import(chrome.runtime.getURL('debug-mode.js'));
    console.log("Debug mode module loaded:", debugMode);
    
    // Force authentication
    console.log("Triggering force sign-in...");
    await debugMode.forceSignIn();
    
    // Check storage to verify tokens
    chrome.storage.local.get(null, (data) => {
      console.log("Storage data:", data);
      
      if (data.twitter_tokens) {
        console.log("✅ Twitter tokens found in storage!");
      } else {
        console.log("❌ Twitter tokens not found!");
      }
      
      if (data.factlens_auth?.signedIn) {
        console.log("✅ User appears to be signed in!");
      } else {
        console.log("❌ User is not signed in!");
      }
      
      // Test complete
      console.log("FactLens test complete");
    });
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testFactLensAuth();

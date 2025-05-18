// Inject script to interact with Grok on grok.x.com
// This script is injected into the Grok page to exchange messages with our extension

// Wait for the page to be fully loaded and Grok to be ready
function waitForGrokInterface() {
  return new Promise((resolve) => {
    const checkGrokReady = () => {
      // Check if the text input area is ready
      const inputArea = document.querySelector('div[contenteditable="true"]');
      if (inputArea) {
        console.log("Grok interface detected");
        resolve(inputArea);
      } else {
        console.log("Waiting for Grok interface...");
        setTimeout(checkGrokReady, 500);
      }
    };
    
    checkGrokReady();
  });
}

// Send a message to the Grok interface
async function sendMessageToGrok(text) {
  // Get the input area
  const inputArea = await waitForGrokInterface();
  
  // Focus on the input area
  inputArea.focus();
  
  // Set the text content
  inputArea.innerText = text;
  
  // Simulate Enter key press to send
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  
  // Send the message
  inputArea.dispatchEvent(enterEvent);
  
  return true;
}

// Wait for Grok's response
function waitForGrokResponse() {
  return new Promise((resolve) => {
    let lastMessageCount = 0;
    let stabilityCounter = 0;
    
    const checkResponses = () => {
      // Look for response messages from Grok
      const messages = document.querySelectorAll('.group p');
      
      if (messages.length > lastMessageCount) {
        // New messages appeared
        lastMessageCount = messages.length;
        stabilityCounter = 0;
      } else {
        // No new messages, increment stability counter
        stabilityCounter++;
      }
      
      if (stabilityCounter >= 5) {
        // If stable for 5 checks (2.5 seconds), assume response is complete
        
        // Get the last message group (Grok's response)
        const responseGroups = document.querySelectorAll('.group');
        const lastGroup = responseGroups[responseGroups.length - 1];
        
        if (lastGroup) {
          // Extract all paragraph text from the last group
          const paragraphs = lastGroup.querySelectorAll('p');
          let responseText = Array.from(paragraphs)
            .map(p => p.innerText)
            .join('\n\n');
            
          resolve(responseText);
        } else {
          resolve("No response detected");
        }
      } else {
        // Check again in 500ms
        setTimeout(checkResponses, 500);
      }
    };
    
    // Start checking after a small delay
    setTimeout(checkResponses, 1000);
  });
}

// Main function to handle fact-checking
async function performFactCheck(text) {
  try {
    // Format the prompt for fact-checking
    const prompt = `Please fact-check the following content and identify any claims that are false or misleading. 
For each claim, provide a verdict of True, False, or Partially True, and explain your reasoning.
If you're uncertain about any claim, indicate that clearly.

CONTENT TO FACT-CHECK:
${text}`;

    // Send the message to Grok
    await sendMessageToGrok(prompt);
    
    // Wait for Grok's response
    const response = await waitForGrokResponse();
    
    // Send the result back to the extension
    chrome.runtime.sendMessage({
      from: "grok-content-script",
      type: "fact-check-result",
      result: response
    });
    
    return response;
  } catch (error) {
    // Send error back to the extension
    chrome.runtime.sendMessage({
      from: "grok-content-script",
      type: "fact-check-error",
      error: error.message
    });
    
    throw error;
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "perform-fact-check") {
    performFactCheck(message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Notify the extension that the script is ready
chrome.runtime.sendMessage({
  from: "grok-content-script",
  type: "ready"
});

console.log("FactLens Grok injection script is ready");

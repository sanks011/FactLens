// Content script for FactLens Chrome Extension
// This script extracts relevant content from web pages for fact-checking

/**
 * Extracts the main content from the webpage, prioritizing article content
 * over navigation, headers, footers, etc.
 */
function extractMainContent() {
  // Try to find the main article content first
  const possibleContentElements = [
    document.querySelector('article'),
    document.querySelector('main'),
    document.querySelector('.content'),
    document.querySelector('#content'),
    document.querySelector('.article'),
    document.querySelector('#article'),
    document.querySelector('.post-content'),
    document.querySelector('.entry-content')
  ];

  // Use the first valid content container we find
  for (const element of possibleContentElements) {
    if (element && element.innerText && element.innerText.trim().length > 100) {
      return element.innerText;
    }
  }

  // If no dedicated content container, try removing obvious non-content elements
  // and use the body
  const body = document.body.cloneNode(true);
  
  // Remove common non-content elements
  const selectorsToRemove = [
    'nav', 'header', 'footer', '.nav', '.navbar', '.menu', 
    '.sidebar', '.comments', '.ad', '.advertisement', '.social',
    'script', 'style', 'noscript'
  ];
  
  selectorsToRemove.forEach(selector => {
    const elements = body.querySelectorAll(selector);
    elements.forEach(element => element.remove());
  });
  
  return body.innerText;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "scrape_content") {
    try {
      console.log("FactLens: Extracting content from page");
      const text = extractMainContent();
      console.log(`FactLens: Extracted ${text.length} characters`);
      sendResponse({ text: text });
    } catch (error) {
      console.error("FactLens: Error extracting content", error);
      sendResponse({ 
        text: document.body.innerText,
        error: error.message 
      });
    }
  }
  return true; // Keeps the message channel open for async response
});
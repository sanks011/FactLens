// Content script for FactLens Chrome Extension
// This script extracts relevant content from web pages for fact-checking

/**
 * Enhanced function to extract the main content from the webpage,
 * using multiple strategies for better content targeting
 */
function extractMainContent() {
  console.log("FactLens: Starting content extraction process");
  
  // Get page metadata for better context
  const pageMetadata = {
    title: document.title || '',
    url: window.location.href,
    domain: window.location.hostname
  };
  
  console.log("FactLens: Page metadata", pageMetadata);
  
  // Get text of all heading elements to understand context
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => h.innerText.trim())
    .filter(text => text.length > 0 && text.length < 200)
    .join(' | ');
  
  console.log("FactLens: Found headings:", headings.substring(0, 100) + (headings.length > 100 ? '...' : ''));
  
  // Strategy 1: Find specific article content containers
  const articleSelectors = [
    // News article selectors
    'article', '.article', '#article', '.post', '.post-content', '.story', '.story-body',
    // Content selectors
    'main[role="main"]', '[role="article"]', '.content', '#content', '.main-content', '#main-content',
    // Blog selectors
    '.entry', '.entry-content', '.blog-post', '.blog-entry',
    // News site specific
    '.article-body', '.article-content', '.news-content'
  ];
  
  // Try each selector and find the one with the most relevant content
  let bestContent = '';
  let bestContentScore = 0;
  
  for (const selector of articleSelectors) {
    const elements = document.querySelectorAll(selector);
    
    for (const element of elements) {
      if (!element || !element.innerText) continue;
      
      const text = element.innerText.trim();
      if (text.length < 100) continue;
      
      // Calculate a relevance score based on text length and structure
      const paragraphs = text.split('\n').filter(p => p.trim().length > 40).length;
      const wordCount = text.split(/\s+/).length;
      const score = wordCount * 0.5 + paragraphs * 10;
      
      if (score > bestContentScore) {
        bestContentScore = score;
        bestContent = text;
        console.log(`FactLens: Found better content using "${selector}" with score ${score}`);
      }
    }
  }
  
  // Strategy 2: If no specific content container found, try collecting all paragraphs
  if (!bestContent) {
    console.log("FactLens: No specific content container found, collecting paragraphs");
    
    const paragraphs = Array.from(document.querySelectorAll('p'))
      .filter(p => {
        const text = p.innerText.trim();
        // Filter out short or empty paragraphs and likely navigation/footer text
        return text.length > 40 && 
               text.split(' ').length > 10 &&
               !text.match(/copyright|all rights reserved|privacy policy|terms of service/i);
      })
      .map(p => p.innerText.trim())
      .join('\n\n');
    
    if (paragraphs.length > 200) {
      bestContent = paragraphs;
      console.log(`FactLens: Collected ${paragraphs.split('\n').length} paragraphs`);
    }
  }
  
  // Strategy 3: If still no good content, use cleaned body content
  if (!bestContent) {
    console.log("FactLens: Using cleaned body content as fallback");
    
    // Clone body to avoid modifying the actual page
    const body = document.body.cloneNode(true);
    
    // Remove non-content elements
    const selectorsToRemove = [
      'nav', 'header', 'footer', '.nav', '.navbar', '.menu', '.navigation',
      '.sidebar', '.comments', '.comment-section', 
      '.ad', '.ads', '.advertisement', '.banner',
      '.social', '.share', '.sharing', '.social-media',
      '.related', '.recommended', '.popular', 
      'script', 'style', 'noscript', 'iframe',
      'form', '.search', '#search', 'button'
    ];
    
    selectorsToRemove.forEach(selector => {
      const elements = body.querySelectorAll(selector);
      elements.forEach(element => element.remove());
    });
    
    bestContent = body.innerText;
  }
  
  // Build the final output with context
  const finalOutput = `
PAGE: ${pageMetadata.title}
URL: ${pageMetadata.url}
${headings ? 'TOPICS: ' + headings + '\n\n' : ''}
CONTENT:
${bestContent.trim()}
  `.trim();
  
  console.log(`FactLens: Extracted ${finalOutput.length} characters of content`);
  return finalOutput;
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
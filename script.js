// Global variables
let currentAnalysisResults = null;

// DOM elements
const pageUrlInput = document.getElementById('page-url');
const primaryKeywordInput = document.getElementById('primary-keyword');
const fetchBtn = document.getElementById('fetch-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const sourceCodeTextarea = document.getElementById('source-code');
const scoreCircle = document.getElementById('score-circle');
const scoreValue = document.getElementById('score-value');
const categoriesGrid = document.getElementById('categories-grid');

// Search elements
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchPrev = document.getElementById('search-prev');
const searchNext = document.getElementById('search-next');
const searchClose = document.getElementById('search-close');
const codeHighlight = document.getElementById('code-highlight');

// Search state
let searchMatches = [];
let currentMatchIndex = -1;

// Event listeners
fetchBtn.addEventListener('click', handleFetch);
analyzeBtn.addEventListener('click', handleAnalyze);

// Search event listeners
searchInput.addEventListener('input', handleSearch);
searchPrev.addEventListener('click', navigateSearch(-1));
searchNext.addEventListener('click', navigateSearch(1));
searchClose.addEventListener('click', clearSearch);
sourceCodeTextarea.addEventListener('input', updateHighlights);
sourceCodeTextarea.addEventListener('scroll', syncScroll);
sourceCodeTextarea.addEventListener('keyup', updateHighlights);
sourceCodeTextarea.addEventListener('paste', () => setTimeout(updateHighlights, 100));

// Keyboard shortcuts for search navigation
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            navigateSearch(-1)(); // Previous match
        } else {
            navigateSearch(1)(); // Next match
        }
    }
    if (e.key === 'Escape') {
        clearSearch();
    }
});

// Handle fetch button click
async function handleFetch() {
    const url = pageUrlInput.value.trim();
    
    if (!url) {
        alert('Please enter a URL first.');
        return;
    }

    fetchBtn.textContent = 'Fetching...';
    fetchBtn.disabled = true;
    
    try {
        const sourceCode = await fetchPageSource(url);
        sourceCodeTextarea.value = sourceCode;
        console.log('Source code fetched successfully');
        // Update highlights if there's an active search
        updateHighlights();
    } catch (error) {
        console.error('Fetch error:', error);
        showFetchInstructions(url);
    }
    
    fetchBtn.textContent = 'Fetch Code';
    fetchBtn.disabled = false;
}

// Main analysis function
async function handleAnalyze() {
    const url = pageUrlInput.value.trim();
    const keyword = primaryKeywordInput.value.trim();
    const sourceCode = sourceCodeTextarea.value.trim();

    if (!keyword) {
        alert('Please enter a primary keyword.');
        return;
    }

    if (!sourceCode) {
        alert('Please provide page source code. Use "Fetch Code" button or paste HTML manually.');
        return;
    }

    // Run analysis
    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;
    
    try {
        const results = analyzePageSEO(sourceCode, keyword, url);
        displayResults(results);
    } catch (error) {
        console.error('Analysis error:', error);
        alert('Error during analysis. Please check the console for details.');
    }
    
    analyzeBtn.textContent = 'Analyze SEO';
    analyzeBtn.disabled = false;
}

// Fetch page source (with multiple CORS proxy attempts)
async function fetchPageSource(url) {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // First try direct fetch (will fail due to CORS in most cases)
    try {
        const response = await fetch(url);
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.log('Direct fetch failed (expected due to CORS):', error.message);
    }

    // Try multiple CORS proxies in order of preference
    const proxies = [
        {
            name: 'Local CORS Proxy',
            url: `http://localhost:8080/proxy?url=${encodeURIComponent(url)}`,
            extractContent: (data) => data.content || data.contents
        },
        {
            name: 'AllOrigins',
            url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            extractContent: (data) => data.contents
        },
        {
            name: 'CORS Anywhere (Heroku)',
            url: `https://cors-anywhere.herokuapp.com/${url}`,
            extractContent: (data) => data
        },
        {
            name: 'ThingProxy',
            url: `https://thingproxy.freeboard.io/fetch/${url}`,
            extractContent: (data) => data
        },
        {
            name: 'CORS.IO',
            url: `https://cors.io/?${url}`,
            extractContent: (data) => data
        }
    ];

    for (const proxy of proxies) {
        try {
            console.log(`Trying ${proxy.name} proxy...`);
            const response = await fetch(proxy.url, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                let data;
                
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                    return proxy.extractContent(data);
                } else {
                    data = await response.text();
                    return proxy.extractContent(data);
                }
            } else {
                console.log(`${proxy.name} failed with status:`, response.status);
            }
        } catch (error) {
            console.log(`${proxy.name} error:`, error.message);
            continue;
        }
    }

    // If all proxies fail, try a simple PHP proxy approach (if available)
    try {
        const phpProxyUrl = `data:text/html,${encodeURIComponent(`
            <script>
                fetch('${url}', {
                    mode: 'no-cors',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                }).then(r => r.text()).then(html => {
                    parent.postMessage({type: 'html', content: html}, '*');
                });
            </script>
        `)}`;
        
        // This is a fallback that likely won't work but worth trying
        const response = await fetch(phpProxyUrl);
        if (response.ok) {
            return await response.text();
        }
    } catch (error) {
        console.log('Fallback method failed:', error.message);
    }

    throw new Error('Unable to fetch due to CORS restrictions. All proxy methods failed.');
}

// Show instructions when fetch fails
function showFetchInstructions(url) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 12px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    
    content.innerHTML = `
        <h3 style="color: #dc3545; margin-bottom: 20px;">🚫 Unable to Fetch Page Source</h3>
        <p style="margin-bottom: 15px;"><strong>Why this happens:</strong> Browsers block cross-origin requests for security reasons (CORS policy).</p>
        
        <h4 style="color: #007bff; margin: 20px 0 10px 0;">🛠️ Easy Solutions:</h4>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h5 style="color: #28a745; margin-bottom: 10px;">Option 1: View Page Source (Recommended)</h5>
            <ol style="margin-left: 20px;">
                <li>Right-click on the webpage you want to analyze</li>
                <li>Select "View Page Source" or press <kbd style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">Ctrl+U</kbd></li>
                <li>Copy all the HTML code (Ctrl+A, then Ctrl+C)</li>
                <li>Paste it into the text area below</li>
            </ol>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h5 style="color: #17a2b8; margin-bottom: 10px;">Option 2: Local Proxy Server (Recommended for Developers)</h5>
            <p>Run our included CORS proxy server:</p>
            <ol style="margin-left: 20px; margin-top: 10px;">
                <li>Open a new terminal/command prompt</li>
                <li>Navigate to your project folder</li>
                <li>Run: <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">python cors-proxy.py</code></li>
                <li>Return here and try fetching again</li>
            </ol>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h5 style="color: #6f42c1; margin-bottom: 10px;">Option 3: Browser Extension</h5>
            <p>Install a CORS browser extension like "CORS Unblock" for Chrome to allow cross-origin requests.</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h5 style="color: #6f42c1; margin-bottom: 10px;">Option 4: Quick Access</h5>
            <p>Click the button below to open the page in a new tab, then follow Option 1:</p>
            <button onclick="window.open('${url}', '_blank')" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 10px;">
                📄 Open Page in New Tab
            </button>
        </div>
        
        <div style="text-align: center;">
            <button onclick="this.closest('.modal').remove()" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px;">
                Got it! Close
            </button>
        </div>
    `;
    
    content.className = 'modal';
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Main SEO analysis function
function analyzePageSEO(sourceCode, primaryKeyword, url = '') {
    const doc = new DOMParser().parseFromString(sourceCode, 'text/html');
    const keyword = primaryKeyword.toLowerCase();
    
    const results = {
        totalScore: 0,
        categories: []
    };

    // Define all categories and their checks
    const categories = [
        {
            name: 'SEO-Friendly URLs',
            checks: [
                () => checkKeywordInUrl(url, keyword),
                () => checkShortDescriptiveUrl(url),
                () => checkHyphenSeparation(url),
                () => checkHttpsProtocol(url),
                () => checkCleanStructure(url)
            ]
        },
        {
            name: 'Title Tag (<title>)',
            checks: [
                () => checkKeywordAtBeginning(doc, keyword),
                () => checkTitleUnder60Chars(doc),
                () => checkNoKeywordStuffingTitle(doc, keyword),
                () => checkCompellingTitle(doc),
                () => checkBrandNameInTitle(doc)
            ]
        },
        {
            name: 'Meta Description',
            checks: [
                () => checkUniqueDescription(doc),
                () => checkDescriptionUnder160Chars(doc),
                () => checkAdCopyStyle(doc),
                () => checkKeywordInDescription(doc, keyword),
                () => checkCTAInDescription(doc)
            ]
        },
        {
            name: 'Header Tags',
            checks: [
                () => checkOneUniqueH1(doc),
                () => checkH1HasKeyword(doc, keyword),
                () => checkLogicalSubheadings(doc),
                () => checkKeywordsInSubheadings(doc, keyword),
                () => checkNoSkippedLevels(doc)
            ]
        },
        {
            name: 'Image Optimization',
            checks: [
                () => checkOptimizedFileSize(doc),
                () => checkDescriptiveFilenames(doc),
                () => checkDescriptiveAltText(doc),
                () => checkAltTextLength(doc),
                () => checkNextGenFormats(doc)
            ]
        },
        {
            name: 'Keyword Placement',
            checks: [
                () => checkKeywordInFirst100Words(doc, keyword),
                () => checkKeywordInH1(doc, keyword),
                () => checkKeywordInSubheadings(doc, keyword),
                () => checkNoKeywordStuffingContent(doc, keyword),
                () => checkKeywordInImageAlt(doc, keyword)
            ]
        },
        {
            name: 'Linking',
            checks: [
                () => checkInternalLinks(doc, url),
                () => checkDescriptiveAnchorText(doc),
                () => checkExternalLinks(doc),
                () => checkContextualPlacement(doc),
                () => checkNoBrokenLinks(doc)
            ]
        },
        {
            name: 'Content',
            checks: [
                () => checkInDepthContent(doc),
                () => checkAuthorByline(doc),
                () => checkDataInsights(doc),
                () => checkFormattedReadability(doc),
                () => checkPurposefulMultimedia(doc)
            ]
        }
    ];

    // Run all checks and calculate scores
    categories.forEach(category => {
        const categoryResult = {
            name: category.name,
            score: 0,
            maxScore: 5,
            checks: []
        };

        category.checks.forEach(checkFunction => {
            const checkResult = checkFunction();
            categoryResult.checks.push(checkResult);
            if (checkResult.passed) {
                categoryResult.score++;
                results.totalScore += 2.5; // Each check worth 2.5 points
            }
        });

        // Generate consolidated fix if there are failures
        const hasFailures = categoryResult.checks.some(check => !check.passed);
        if (hasFailures) {
            categoryResult.consolidatedFix = generateConsolidatedFix(category.name, doc, keyword, url);
        }

        results.categories.push(categoryResult);
    });

    return results;
}

// =============================================================================
// SEO-FRIENDLY URLS CHECKS
// =============================================================================

function checkKeywordInUrl(url, keyword) {
    const passed = url.toLowerCase().includes(keyword);
    return {
        passed,
        text: passed ? 'URL contains the primary keyword.' : 'URL does not contain the primary keyword.'
    };
}

function checkShortDescriptiveUrl(url) {
    const cleanUrl = url.replace(/^https?:\/\/[^\/]+/, ''); // Remove protocol and domain
    const hasQueryParams = url.includes('?id=') || url.includes('&id=') || /\?p=\d+/.test(url);
    const isShort = cleanUrl.length < 60;
    const passed = isShort && !hasQueryParams;
    return {
        passed,
        text: passed ? 'URL is short and descriptive.' : 'URL is long, cryptic, or uses query IDs.'
    };
}

function checkHyphenSeparation(url) {
    const pathPart = url.replace(/^https?:\/\/[^\/]+/, '');
    const hasHyphens = pathPart.includes('-');
    const hasUnderscores = pathPart.includes('_');
    const passed = hasHyphens || !pathPart.includes(' ');
    return {
        passed,
        text: passed ? 'Uses hyphens for word separation.' : 'Does not use hyphens for word separation.'
    };
}

function checkHttpsProtocol(url) {
    const passed = url.startsWith('https://');
    return {
        passed,
        text: passed ? 'Uses secure HTTPS protocol.' : 'Does not use HTTPS (uses insecure HTTP).'
    };
}

function checkCleanStructure(url) {
    const hasFileExtension = /\.(html|htm|php|asp)$/i.test(url);
    const hasMixedCase = /[A-Z]/.test(url.replace(/^https?:\/\/[^\/]+/, ''));
    const passed = !hasFileExtension && !hasMixedCase;
    return {
        passed,
        text: passed ? 'URL has a clean, lowercase structure.' : 'URL uses mixed case or unnecessary file extensions.'
    };
}

// =============================================================================
// TITLE TAG CHECKS
// =============================================================================

function checkKeywordAtBeginning(doc, keyword) {
    const titleElement = doc.querySelector('title');
    if (!titleElement) {
        return { 
            passed: false, 
            text: 'Primary keyword is not near the beginning.'
        };
    }
    const title = titleElement.textContent.toLowerCase();
    const words = title.split(/\s+/);
    const keywordPosition = words.findIndex(word => word.includes(keyword));
    const passed = keywordPosition >= 0 && keywordPosition <= 2;
    return {
        passed,
        text: passed ? 'Primary keyword is near the beginning.' : 'Primary keyword is not near the beginning.'
    };
}

function checkTitleUnder60Chars(doc) {
    const titleElement = doc.querySelector('title');
    if (!titleElement) {
        return { 
            passed: false, 
            text: 'Title tag is over 60 characters.'
        };
    }
    const titleLength = titleElement.textContent.length;
    const passed = titleLength <= 60;
    return {
        passed,
        text: passed ? 'Title tag is under 60 characters.' : 'Title tag is over 60 characters.'
    };
}

function checkNoKeywordStuffingTitle(doc, keyword) {
    const titleElement = doc.querySelector('title');
    if (!titleElement) {
        return { passed: true, text: 'Title tag avoids keyword stuffing.' };
    }
    const title = titleElement.textContent.toLowerCase();
    const keywordCount = (title.match(new RegExp(keyword, 'g')) || []).length;
    const passed = keywordCount <= 2;
    return {
        passed,
        text: passed ? 'Title tag avoids keyword stuffing.' : 'Title tag appears to be keyword-stuffed.'
    };
}

function checkCompellingTitle(doc) {
    const titleElement = doc.querySelector('title');
    if (!titleElement) {
        return { passed: false, text: 'Title is generic or does not reflect content.' };
    }
    const title = titleElement.textContent.toLowerCase();
    const genericTerms = ['welcome', 'home page', 'untitled', 'new page', 'page 1'];
    const isGeneric = genericTerms.some(term => title.includes(term));
    const hasAction = /\b(get|buy|learn|discover|find|best|top|how|guide)\b/.test(title);
    const passed = !isGeneric && (hasAction || title.length > 20);
    return {
        passed,
        text: passed ? 'Title is compelling and reflects content.' : 'Title is generic or does not reflect content.'
    };
}

function checkBrandNameInTitle(doc) {
    const titleElement = doc.querySelector('title');
    if (!titleElement) {
        return { passed: false, text: 'Does not include a brand name.' };
    }
    const title = titleElement.textContent;
    const hasPipe = title.includes('|');
    const hasDash = title.includes(' - ');
    const hasCapitalizedWord = /\b[A-Z][a-z]+\b/.test(title);
    const passed = (hasPipe || hasDash) && hasCapitalizedWord;
    return {
        passed,
        text: passed ? 'Includes the brand name.' : 'Does not include a brand name.'
    };
}

// =============================================================================
// META DESCRIPTION CHECKS
// =============================================================================

function checkUniqueDescription(doc) {
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc || !metaDesc.getAttribute('content')) {
        return { 
            passed: false, 
            text: 'Meta description is missing or generic.'
        };
    }
    const content = metaDesc.getAttribute('content').toLowerCase();
    const genericTerms = ['lorem ipsum', 'default description', 'add description', 'page description'];
    const isGeneric = genericTerms.some(term => content.includes(term));
    const passed = !isGeneric && content.length > 50;
    
    return {
        passed,
        text: passed ? 'Meta description appears to be unique.' : 'Meta description is missing or generic.'
    };
}

function checkDescriptionUnder160Chars(doc) {
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc) {
        return { 
            passed: false, 
            text: 'Meta description is over 160 characters.'
        };
    }
    const content = metaDesc.getAttribute('content') || '';
    const passed = content.length <= 160;
    return {
        passed,
        text: passed ? 'Meta description is under 160 characters.' : 'Meta description is over 160 characters.'
    };
}

function checkAdCopyStyle(doc) {
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc) {
        return { passed: false, text: 'Description is a dry, unengaging statement.' };
    }
    const content = metaDesc.getAttribute('content') || '';
    const hasAction = /\b(discover|learn|get|find|explore|see|check|try|start|join)\b/i.test(content);
    const hasBenefit = /\b(best|top|easy|quick|free|save|improve|increase|boost)\b/i.test(content);
    const passed = hasAction || hasBenefit;
    return {
        passed,
        text: passed ? 'Description is written like compelling ad copy.' : 'Description is a dry, unengaging statement.'
    };
}

function checkKeywordInDescription(doc, keyword) {
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc) {
        return { 
            passed: false, 
            text: 'Meta description does not include the primary keyword.'
        };
    }
    const content = metaDesc.getAttribute('content').toLowerCase();
    const passed = content.includes(keyword);
    return {
        passed,
        text: passed ? 'Meta description includes the primary keyword.' : 'Meta description does not include the primary keyword.'
    };
}

function checkCTAInDescription(doc) {
    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc) {
        return { passed: false, text: 'Meta description is missing a Call-to-Action.' };
    }
    const content = metaDesc.getAttribute('content') || '';
    const ctaPatterns = /\b(learn more|read more|get started|sign up|try now|contact us|call now|visit|shop now|download|subscribe)\b/i;
    const passed = ctaPatterns.test(content);
    return {
        passed,
        text: passed ? 'Meta description includes a Call-to-Action.' : 'Meta description is missing a Call-to-Action.'
    };
}

// =============================================================================
// HEADER TAGS CHECKS
// =============================================================================

function checkOneUniqueH1(doc) {
    const h1Elements = doc.querySelectorAll('h1');
    const passed = h1Elements.length === 1;
    return {
        passed,
        text: passed ? 'Page has exactly one <h1> tag.' : 'Page has zero or more than one <h1> tag.'
    };
}

function checkH1HasKeyword(doc, keyword) {
    const h1Element = doc.querySelector('h1');
    if (!h1Element) {
        return { 
            passed: false, 
            text: 'The <h1> tag does not contain the primary keyword.'
        };
    }
    const h1Text = h1Element.textContent.toLowerCase();
    const passed = h1Text.includes(keyword);
    return {
        passed,
        text: passed ? 'The <h1> tag contains the primary keyword.' : 'The <h1> tag does not contain the primary keyword.'
    };
}

function checkLogicalSubheadings(doc) {
    const h2Elements = doc.querySelectorAll('h2');
    const h3Elements = doc.querySelectorAll('h3');
    const passed = h2Elements.length >= 2 || h3Elements.length >= 1;
    return {
        passed,
        text: passed ? 'Uses <h2> and <h3> for structure.' : 'Content lacks structured <h2>/<h3> subheadings.'
    };
}

function checkKeywordsInSubheadings(doc, keyword) {
    const subheadings = doc.querySelectorAll('h2, h3, h4, h5, h6');
    let hasKeywordVariation = false;
    
    subheadings.forEach(heading => {
        const text = heading.textContent.toLowerCase();
        const keywordRoot = keyword.replace(/s$/, ''); // Simple pluralization check
        if (text.includes(keyword) || text.includes(keywordRoot)) {
            hasKeywordVariation = true;
        }
    });
    
    const genericTerms = ['our process', 'about us', 'contact us', 'services', 'products'];
    let hasGeneric = false;
    subheadings.forEach(heading => {
        const text = heading.textContent.toLowerCase();
        if (genericTerms.some(term => text.includes(term))) {
            hasGeneric = true;
        }
    });
    
    const passed = hasKeywordVariation && !hasGeneric;
    return {
        passed,
        text: passed ? 'Subheadings include related keywords.' : 'Subheadings are generic (e.g., "Our Process").'
    };
}

function checkNoSkippedLevels(doc) {
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    let hasSkipped = false;
    
    headings.forEach(heading => {
        const currentLevel = parseInt(heading.tagName.charAt(1));
        if (currentLevel > previousLevel + 1) {
            hasSkipped = true;
        }
        previousLevel = currentLevel;
    });
    
    const passed = !hasSkipped;
    return {
        passed,
        text: passed ? 'Heading levels follow a logical order (h1→h2→h3).' : 'Heading hierarchy is skipped (e.g., h2→h4).'
    };
}

// =============================================================================
// IMAGE OPTIMIZATION CHECKS
// =============================================================================

function checkOptimizedFileSize(doc) {
    const images = doc.querySelectorAll('img');
    let hasLargeImages = false;
    
    images.forEach(img => {
        const src = img.getAttribute('src') || '';
        // Simple heuristic: if filename suggests large size or has dimension indicators
        if (/large|big|huge|\d{4,}x\d{4,}/.test(src.toLowerCase())) {
            hasLargeImages = true;
        }
    });
    
    const passed = !hasLargeImages;
    return {
        passed,
        text: passed ? 'All image file sizes appear optimized (<150KB).' : 'One or more images have large file sizes.'
    };
}

function checkDescriptiveFilenames(doc) {
    const images = doc.querySelectorAll('img');
    let hasGenericNames = false;
    
    images.forEach(img => {
        const src = img.getAttribute('src') || '';
        const filename = src.split('/').pop().toLowerCase();
        if (/^(img_|image|dsc|p\d+|photo|\d+)/.test(filename) || /\.(jpg|png|gif)$/i.test(filename) && filename.length < 10) {
            hasGenericNames = true;
        }
    });
    
    const passed = !hasGenericNames && images.length > 0;
    return {
        passed,
        text: passed ? 'Image filenames are descriptive.' : 'Image filenames are generic (e.g., IMG_1234.jpg).'
    };
}

function checkDescriptiveAltText(doc) {
    const images = doc.querySelectorAll('img');
    let missingAlt = false;
    
    images.forEach(img => {
        const alt = img.getAttribute('alt');
        if (!alt || alt.trim().length < 5) {
            missingAlt = true;
        }
    });
    
    const passed = !missingAlt && images.length > 0;
    return {
        passed,
        text: passed ? 'All images have descriptive alt text.' : 'One or more images are missing alt text.'
    };
}

function checkAltTextLength(doc) {
    const images = doc.querySelectorAll('img');
    let hasLongAlt = false;
    
    images.forEach(img => {
        const alt = img.getAttribute('alt') || '';
        if (alt.length > 125) {
            hasLongAlt = true;
        }
    });
    
    const passed = !hasLongAlt;
    return {
        passed,
        text: passed ? 'All alt text is under 125 characters.' : 'One or more alt text descriptions exceed 125 chars.'
    };
}

function checkNextGenFormats(doc) {
    const images = doc.querySelectorAll('img');
    let hasNextGen = false;
    
    images.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (/\.(webp|avif)$/i.test(src)) {
            hasNextGen = true;
        }
    });
    
    const passed = hasNextGen && images.length > 0;
    return {
        passed,
        text: passed ? 'Uses next-gen formats (WebP/AVIF).' : 'Uses older image formats (JPEG/PNG).'
    };
}

// =============================================================================
// KEYWORD PLACEMENT CHECKS
// =============================================================================

function checkKeywordInFirst100Words(doc, keyword) {
    const bodyText = doc.body ? doc.body.textContent : '';
    const words = bodyText.trim().split(/\s+/).slice(0, 100);
    const first100Words = words.join(' ').toLowerCase();
    const passed = first100Words.includes(keyword);
    return {
        passed,
        text: passed ? 'Keyword appears in the first 100 words.' : 'Keyword is not found in the first 100 words.'
    };
}

function checkKeywordInH1(doc, keyword) {
    const h1Element = doc.querySelector('h1');
    if (!h1Element) {
        return { passed: false, text: 'Keyword does not appear in the <h1> tag.' };
    }
    const h1Text = h1Element.textContent.toLowerCase();
    const passed = h1Text.includes(keyword);
    return {
        passed,
        text: passed ? 'Keyword appears in the <h1> tag.' : 'Keyword does not appear in the <h1> tag.'
    };
}

function checkKeywordInSubheadings(doc, keyword) {
    const subheadings = doc.querySelectorAll('h2, h3, h4, h5, h6');
    let found = false;
    
    subheadings.forEach(heading => {
        if (heading.textContent.toLowerCase().includes(keyword)) {
            found = true;
        }
    });
    
    const passed = found;
    return {
        passed,
        text: passed ? 'Keyword appears in at least one subheading (h2-h6).' : 'Keyword is not used in any subheadings.'
    };
}

function checkNoKeywordStuffingContent(doc, keyword) {
    const bodyText = doc.body ? doc.body.textContent : '';
    const words = bodyText.toLowerCase().split(/\s+/);
    const keywordCount = words.filter(word => word.includes(keyword)).length;
    const density = keywordCount / words.length;
    const passed = density <= 0.03; // Less than 3% density
    return {
        passed,
        text: passed ? 'Keyword density is natural and not stuffed.' : 'Content shows signs of keyword stuffing.'
    };
}

function checkKeywordInImageAlt(doc, keyword) {
    const images = doc.querySelectorAll('img[alt]');
    let found = false;
    
    images.forEach(img => {
        const alt = img.getAttribute('alt').toLowerCase();
        if (alt.includes(keyword)) {
            found = true;
        }
    });
    
    const passed = found && images.length > 0;
    return {
        passed,
        text: passed ? 'Keyword appears in at least one image alt text.' : 'Keyword is not used in any image alt text.'
    };
}

// =============================================================================
// LINKING CHECKS
// =============================================================================

function checkInternalLinks(doc, url) {
    const links = doc.querySelectorAll('a[href]');
    const domain = url ? new URL(url).hostname : '';
    let hasInternal = false;
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.startsWith('/') || href.includes(domain))) {
            hasInternal = true;
        }
    });
    
    const passed = hasInternal;
    return {
        passed,
        text: passed ? 'Content includes relevant internal links.' : 'No internal links were found in the main content.'
    };
}

function checkDescriptiveAnchorText(doc) {
    const links = doc.querySelectorAll('a[href]');
    let hasGeneric = false;
    
    links.forEach(link => {
        const text = link.textContent.toLowerCase().trim();
        const genericTerms = ['click here', 'read more', 'here', 'link', 'this', 'more'];
        if (genericTerms.includes(text)) {
            hasGeneric = true;
        }
    });
    
    const passed = !hasGeneric && links.length > 0;
    return {
        passed,
        text: passed ? 'Internal links use descriptive anchor text.' : 'Links use generic anchor text (e.g., "click here").'
    };
}

function checkExternalLinks(doc) {
    const links = doc.querySelectorAll('a[href]');
    let hasExternal = false;
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
            hasExternal = true;
        }
    });
    
    const passed = hasExternal;
    return {
        passed,
        text: passed ? 'Links to authoritative external sources exist.' : 'No authoritative external links were found.'
    };
}

function checkContextualPlacement(doc) {
    const contentArea = doc.querySelector('main, article, .content, #content') || doc.body;
    const linksInContent = contentArea ? contentArea.querySelectorAll('a[href]') : [];
    const allLinks = doc.querySelectorAll('a[href]');
    
    const contextualRatio = linksInContent.length / Math.max(allLinks.length, 1);
    const passed = contextualRatio > 0.5; // More than 50% of links are in main content
    return {
        passed,
        text: passed ? 'Links are contextually placed within content.' : 'Links are isolated in lists, footers, or sidebars.'
    };
}

function checkNoBrokenLinks(doc) {
    // Note: We can't actually test HTTP status codes in this environment
    // This is a heuristic check for obviously broken links
    const links = doc.querySelectorAll('a[href]');
    let hasBroken = false;
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.includes('404') || href.includes('error') || href === '#')) {
            hasBroken = true;
        }
    });
    
    const passed = !hasBroken;
    return {
        passed,
        text: passed ? 'All tested links are valid (return 200 OK).' : 'One or more broken links (e.g., 404) were found.'
    };
}

// =============================================================================
// CONTENT CHECKS
// =============================================================================

function checkInDepthContent(doc) {
    const bodyText = doc.body ? doc.body.textContent : '';
    const wordCount = bodyText.trim().split(/\s+/).length;
    const passed = wordCount >= 1000;
    return {
        passed,
        text: passed ? 'Content is substantial and in-depth (>1000 words).' : 'Content is thin or superficial (<1000 words).'
    };
}

function checkAuthorByline(doc) {
    const authorSelectors = [
        '[class*="author"]',
        '[class*="byline"]',
        '.by-author',
        '.author-name',
        '[rel="author"]'
    ];
    
    let hasAuthor = false;
    authorSelectors.forEach(selector => {
        if (doc.querySelector(selector)) {
            hasAuthor = true;
        }
    });
    
    // Also check for common author patterns in text
    const bodyText = doc.body ? doc.body.textContent.toLowerCase() : '';
    const authorPatterns = /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+|written by|author:/;
    if (authorPatterns.test(bodyText)) {
        hasAuthor = true;
    }
    
    const passed = hasAuthor;
    return {
        passed,
        text: passed ? 'Includes a clear author name and/or bio.' : 'Content is anonymous with no clear author.'
    };
}

function checkDataInsights(doc) {
    const bodyText = doc.body ? doc.body.textContent.toLowerCase() : '';
    const dataPatterns = /\b(\d+%|\d+\.\d+%|study|research|survey|according to|statistics|data|report|findings)\b/;
    const passed = dataPatterns.test(bodyText);
    return {
        passed,
        text: passed ? 'Content includes data, stats, or original insights.' : 'Content relies on vague claims without data.'
    };
}

function checkFormattedReadability(doc) {
    const paragraphs = doc.querySelectorAll('p');
    const lists = doc.querySelectorAll('ul, ol');
    const headings = doc.querySelectorAll('h2, h3, h4, h5, h6');
    
    let hasLongParagraphs = false;
    paragraphs.forEach(p => {
        if (p.textContent.length > 500) { // Very long paragraphs
            hasLongParagraphs = true;
        }
    });
    
    const hasGoodStructure = lists.length > 0 && headings.length > 1 && !hasLongParagraphs;
    const passed = hasGoodStructure;
    return {
        passed,
        text: passed ? 'Content is well-formatted (short paras, lists).' : 'Content is a wall of text, hard to scan.'
    };
}

function checkPurposefulMultimedia(doc) {
    const images = doc.querySelectorAll('img');
    const videos = doc.querySelectorAll('video');
    const iframes = doc.querySelectorAll('iframe'); // For embedded content
    
    let hasStockImages = false;
    images.forEach(img => {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        if (/stock|shutterstock|getty|generic/.test(src.toLowerCase()) || 
            /stock|generic/.test(alt.toLowerCase())) {
            hasStockImages = true;
        }
    });
    
    const hasMultimedia = images.length > 0 || videos.length > 0 || iframes.length > 0;
    const passed = hasMultimedia && !hasStockImages;
    return {
        passed,
        text: passed ? 'Uses relevant, non-stock multimedia.' : 'Uses generic stock photos or no multimedia.'
    };
}

// =============================================================================
// RESULT DISPLAY FUNCTIONS
// =============================================================================

function displayResults(results) {
    currentAnalysisResults = results;
    
    // Update overall score
    updateOverallScore(results.totalScore);
    
    // Clear and populate categories grid
    categoriesGrid.innerHTML = '';
    results.categories.forEach(category => {
        const categoryCard = createCategoryCard(category);
        categoriesGrid.appendChild(categoryCard);
    });
}

function updateOverallScore(score) {
    const roundedScore = Math.round(score);
    scoreValue.textContent = roundedScore;
    
    // Update circular progress
    const progressPercentage = score;
    scoreCircle.style.setProperty('--progress', `${progressPercentage}%`);
    
    // Update circle color based on score
    let progressColor = '#38a169'; // Green for good scores
    if (score < 70) {
        progressColor = '#e53e3e'; // Red for poor scores
    } else if (score < 80) {
        progressColor = '#ed8936'; // Orange for fair scores
    } else if (score < 90) {
        progressColor = '#ecc94b'; // Yellow for good scores
    }
    
    scoreCircle.style.background = `conic-gradient(from 0deg, ${progressColor} ${progressPercentage}%, #4a5568 ${progressPercentage}%)`;
}

function createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    
    const header = document.createElement('div');
    header.className = 'category-header';
    
    const title = document.createElement('div');
    title.className = 'category-title';
    title.textContent = category.name;
    
    const score = document.createElement('div');
    score.className = 'category-score';
    score.textContent = `${category.score}/${category.maxScore}`;
    
    header.appendChild(title);
    header.appendChild(score);
    
    const checksList = document.createElement('ul');
    checksList.className = 'checks-list';
    
    category.checks.forEach(check => {
        const checkItem = document.createElement('li');
        checkItem.className = `check-item ${check.passed ? 'check-pass' : 'check-fail'}`;
        
        const icon = document.createElement('span');
        icon.className = 'check-icon';
        icon.textContent = check.passed ? '✓' : '✗';
        
        const text = document.createElement('span');
        text.className = 'check-text';
        text.textContent = check.text;
        
        checkItem.appendChild(icon);
        checkItem.appendChild(text);
        checksList.appendChild(checkItem);
    });
    
    card.appendChild(header);
    card.appendChild(checksList);
    
    // Add consolidated recommendation if there are any failures
    const hasFailures = category.checks.some(check => !check.passed);
    
    if (hasFailures && category.consolidatedFix) {
        const recommendations = document.createElement('div');
        recommendations.className = 'recommendations';
        
        const recItem = document.createElement('div');
        recItem.className = 'recommendation-item recommendation-fix';
        
        const recLabel = document.createElement('div');
        recLabel.className = 'recommendation-label';
        recLabel.textContent = 'Recommended Fix';
        
        const recContent = document.createElement('div');
        recContent.className = 'recommendation-content';
        recContent.innerHTML = category.consolidatedFix;
        
        recItem.appendChild(recLabel);
        recItem.appendChild(recContent);
        recommendations.appendChild(recItem);
        
        card.appendChild(recommendations);
    }
    
    return card;
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================

function handleSearch() {
    const searchTerm = searchInput.value.trim();
    const sourceText = sourceCodeTextarea.value;
    
    if (!searchTerm || !sourceText) {
        clearHighlights();
        return;
    }
    
    // Find all matches
    searchMatches = [];
    const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
    let match;
    
    while ((match = regex.exec(sourceText)) !== null) {
        searchMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[0]
        });
    }
    
    // Update search results display
    updateSearchResults();
    
    // Highlight matches
    highlightMatches(sourceText, searchTerm);
    
    // Navigate to first match
    if (searchMatches.length > 0) {
        currentMatchIndex = 0;
        highlightCurrentMatch();
        // Ensure scrolling happens after all DOM updates
        setTimeout(() => {
            scrollToCurrentMatch();
        }, 100);
    }
}

function updateSearchResults() {
    const count = searchMatches.length;
    if (count === 0) {
        searchResults.textContent = 'No results';
        searchPrev.disabled = true;
        searchNext.disabled = true;
    } else {
        searchResults.textContent = `${currentMatchIndex + 1} of ${count}`;
        searchPrev.disabled = currentMatchIndex <= 0;
        searchNext.disabled = currentMatchIndex >= count - 1;
    }
}

function navigateSearch(direction) {
    return function() {
        if (searchMatches.length === 0) return;
        
        console.log(`Navigating ${direction > 0 ? 'down' : 'up'} from match ${currentMatchIndex + 1}`);
        
        currentMatchIndex += direction;
        
        // Wrap around
        if (currentMatchIndex < 0) {
            currentMatchIndex = searchMatches.length - 1;
        } else if (currentMatchIndex >= searchMatches.length) {
            currentMatchIndex = 0;
        }
        
        console.log(`Now at match ${currentMatchIndex + 1} of ${searchMatches.length}`);
        
        updateSearchResults();
        highlightCurrentMatch();
        
        // Ensure scrolling happens after highlighting
        requestAnimationFrame(() => {
            setTimeout(() => {
                scrollToCurrentMatch();
            }, 10);
        });
    };
}

function clearSearch() {
    searchInput.value = '';
    clearHighlights();
    searchMatches = [];
    currentMatchIndex = -1;
    updateSearchResults();
}

function highlightMatches(sourceText, searchTerm) {
    if (!searchTerm) {
        codeHighlight.innerHTML = '';
        return;
    }
    
    // Escape HTML and highlight matches
    const escapedText = escapeHtml(sourceText);
    const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
    const highlightedText = escapedText.replace(regex, '<span class="highlight">$1</span>');
    
    codeHighlight.innerHTML = highlightedText;
    
    // Ensure proper positioning and sync
    setTimeout(() => {
        syncScroll();
    }, 10);
    
    console.log(`Highlighted ${searchMatches.length} matches for "${searchTerm}"`);
}

function highlightCurrentMatch() {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) return;
    
    // Remove previous current highlight
    const highlights = codeHighlight.querySelectorAll('.highlight');
    highlights.forEach(el => el.classList.remove('current'));
    
    // Add current highlight
    if (highlights[currentMatchIndex]) {
        highlights[currentMatchIndex].classList.add('current');
        
        // Add a brief flash effect to draw attention
        highlights[currentMatchIndex].style.animation = 'flash 0.5s ease-in-out';
        setTimeout(() => {
            if (highlights[currentMatchIndex]) {
                highlights[currentMatchIndex].style.animation = '';
            }
        }, 500);
    }
}

function scrollToCurrentMatch() {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) return;
    
    const match = searchMatches[currentMatchIndex];
    const textBeforeMatch = sourceCodeTextarea.value.substring(0, match.start);
    const lines = textBeforeMatch.split('\n');
    const lineNumber = lines.length - 1;
    
    // More accurate line height calculation
    const computedStyle = window.getComputedStyle(sourceCodeTextarea);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 18;
    
    // Calculate the exact position of the match
    const matchTop = lineNumber * lineHeight;
    
    // Get container dimensions
    const containerHeight = sourceCodeTextarea.clientHeight;
    const containerWidth = sourceCodeTextarea.clientWidth;
    
    // Calculate centered vertical scroll position
    const centeredScrollTop = matchTop - (containerHeight / 2) + (lineHeight / 2);
    
    // Ensure we don't scroll beyond boundaries
    const maxScrollTop = sourceCodeTextarea.scrollHeight - containerHeight;
    const finalScrollTop = Math.max(0, Math.min(centeredScrollTop, maxScrollTop));
    
    // Calculate horizontal position
    const currentLineText = lines[lineNumber] || '';
    const characterPosition = textBeforeMatch.length - (textBeforeMatch.lastIndexOf('\n') + 1);
    
    // More accurate character width calculation
    const fontSize = parseFloat(computedStyle.fontSize) || 12;
    const characterWidth = fontSize * 0.6; // Monospace character width approximation
    const matchLeft = characterPosition * characterWidth;
    
    // Calculate centered horizontal scroll position
    const centeredScrollLeft = matchLeft - (containerWidth / 2);
    const maxScrollLeft = sourceCodeTextarea.scrollWidth - containerWidth;
    const finalScrollLeft = Math.max(0, Math.min(centeredScrollLeft, maxScrollLeft));
    
    // Apply scroll immediately for reliable positioning
    sourceCodeTextarea.scrollTop = finalScrollTop;
    sourceCodeTextarea.scrollLeft = finalScrollLeft;
    
    // Force immediate sync
    syncScroll();
    
    // Add smooth animation effect separately if needed
    sourceCodeTextarea.style.scrollBehavior = 'smooth';
    setTimeout(() => {
        sourceCodeTextarea.style.scrollBehavior = 'auto';
    }, 300);
    
    console.log(`Scrolling to match ${currentMatchIndex + 1} at line ${lineNumber + 1}, centering in viewport`);
}

function clearHighlights() {
    codeHighlight.innerHTML = '';
    console.log('Highlights cleared');
}

function updateHighlights() {
    // Update the highlight overlay when textarea content changes
    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        handleSearch();
    } else {
        clearHighlights();
    }
    // Ensure scroll sync
    syncScroll();
}

function syncScroll() {
    // Sync scroll position between textarea and highlight overlay
    if (codeHighlight && sourceCodeTextarea) {
        requestAnimationFrame(() => {
            codeHighlight.scrollTop = sourceCodeTextarea.scrollTop;
            codeHighlight.scrollLeft = sourceCodeTextarea.scrollLeft;
        });
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Generate meta description from page content
function generateMetaDescription(doc) {
    const h1 = doc.querySelector('h1');
    const title = doc.querySelector('title');
    const firstParagraph = doc.querySelector('p');
    
    let description = '';
    
    // Start with H1 or title
    if (h1 && h1.textContent.trim()) {
        description = h1.textContent.trim();
    } else if (title && title.textContent.trim()) {
        description = title.textContent.trim();
    }
    
    // Add context from first paragraph
    if (firstParagraph && firstParagraph.textContent.trim()) {
        const paragraphText = firstParagraph.textContent.trim();
        const firstSentence = paragraphText.split('.')[0];
        if (firstSentence.length > 20 && firstSentence.length < 100) {
            description += description ? '. ' + firstSentence : firstSentence;
        }
    }
    
    // Add call to action
    const ctaWords = ['Learn', 'Discover', 'Get', 'Find', 'Start', 'Contact', 'Explore'];
    const randomCta = ctaWords[Math.floor(Math.random() * ctaWords.length)];
    
    if (description.length < 120) {
        description += `. ${randomCta} more today!`;
    }
    
    // Ensure it's under 160 characters
    if (description.length > 157) {
        description = description.substring(0, 157) + '...';
    }
    
    return description || 'Professional services and solutions. Contact us to learn more about our offerings.';
}

// Generate meta description with specific keyword
function generateMetaDescriptionWithKeyword(doc, keyword) {
    const h1 = doc.querySelector('h1');
    const title = doc.querySelector('title');
    const firstParagraph = doc.querySelector('p');
    
    let description = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    
    // Add context from H1 or title
    if (h1 && h1.textContent.trim()) {
        const h1Text = h1.textContent.trim().replace(new RegExp(keyword, 'gi'), '').trim();
        if (h1Text.length > 10) {
            description += ' - ' + h1Text;
        }
    } else if (title && title.textContent.trim()) {
        const titleText = title.textContent.trim().replace(new RegExp(keyword, 'gi'), '').trim();
        if (titleText.length > 10) {
            description += ' - ' + titleText;
        }
    }
    
    // Add context from first paragraph if space allows
    if (description.length < 100 && firstParagraph && firstParagraph.textContent.trim()) {
        const paragraphText = firstParagraph.textContent.trim();
        const firstSentence = paragraphText.split('.')[0];
        if (firstSentence.length > 20 && firstSentence.length < 80) {
            description += '. ' + firstSentence;
        }
    }
    
    // Add call to action with keyword
    if (description.length < 130) {
        description += `. Get the best ${keyword} solutions today!`;
    }
    
    // Ensure it's under 160 characters
    if (description.length > 157) {
        description = description.substring(0, 157) + '...';
    }
    
    return description;
}

// Generate consolidated fix for each category
function generateConsolidatedFix(categoryName, doc, keyword, url) {
    const domain = url.replace(/^https?:\/\/([^\/]+).*/, '$1');
    const brandName = domain?.split('.')[0]?.charAt(0).toUpperCase() + domain?.split('.')[0]?.slice(1) || 'Brand';
    const keywordSlug = keyword.replace(/\s+/g, '-').toLowerCase();
    
    switch (categoryName) {
        case 'SEO-Friendly URLs':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
SEO-friendly URLs signal your page's topic to users and search engines, improving relevance and trust.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>INCLUDE KEYWORD:</strong> Use <span class="good-example">.../${keywordSlug}</span> instead of <span class="bad-example">.../id-721</span></div>
<div class="bullet-point">• <strong>BE DESCRIPTIVE:</strong> Use <span class="good-example">.../services/${keywordSlug}</span> instead of <span class="bad-example">.../post?id=45&cat=seo</span></div>
<div class="bullet-point">• <strong>USE HYPHENS:</strong> Search engines read <span class="good-example">.../aerial-lidar</span> correctly vs <span class="bad-example">.../aerial_lidar</span></div>
<div class="bullet-point">• <strong>USE HTTPS:</strong> Secure <span class="good-example">https://${domain}</span> builds trust vs <span class="bad-example">http://${domain}</span></div>
<div class="bullet-point">• <strong>CLEAN STRUCTURE:</strong> Use lowercase paths without file extensions</div>

<div class="section-header">📝 RECOMMENDED URL</div>
<div class="code-example">https://${domain}/services/${keywordSlug}</div>`;

        case 'Title Tag (<title>)':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Title tags are your headline in search results and a critical ranking factor. They must grab attention and signal relevance.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>KEYWORD FIRST:</strong> Maximizes visibility and signals relevance immediately</div>
<div class="bullet-point">• <strong>UNDER 60 CHARACTERS:</strong> Prevents truncation in search results</div>
<div class="bullet-point">• <strong>NO KEYWORD STUFFING:</strong> Avoid repetitive keywords that look spammy</div>
<div class="bullet-point">• <strong>BE COMPELLING:</strong> Act as a headline that encourages clicks</div>
<div class="bullet-point">• <strong>INCLUDE BRAND:</strong> Build recognition with brand name at end</div>

<div class="section-header">❌ AVOID</div>
<div class="code-example bad-example">&lt;title&gt;${brandName} | Our ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Services&lt;/title&gt;</div>

<div class="section-header">📝 RECOMMENDED TITLE</div>
<div class="code-example">&lt;title&gt;${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Solutions &amp; Engineering | ${brandName}&lt;/title&gt;</div>`;

        case 'Meta Description':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Meta descriptions are your ad copy in search results. They must be compelling to improve click-through rates and include your keyword.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>UNIQUE FOR EACH PAGE:</strong> Differentiate from other pages, avoid generic text</div>
<div class="bullet-point">• <strong>UNDER 160 CHARACTERS:</strong> Prevents truncation in search results</div>
<div class="bullet-point">• <strong>LIKE AD COPY:</strong> Write compelling, benefit-driven content</div>
<div class="bullet-point">• <strong>INCLUDE KEYWORD:</strong> Gets bolded when users search for "${keyword}"</div>
<div class="bullet-point">• <strong>CLEAR CTA:</strong> End with action words like "Learn more" or "Get started"</div>

<div class="section-header">📝 RECOMMENDED META DESCRIPTION</div>
<div class="code-example">&lt;meta name="description" content="Expert ${keyword} solutions by ${brandName}. Innovative approaches with proven results. Get your ${keyword} consultation today!"&gt;</div>`;

        case 'Header Tags':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Proper heading structure helps users scan content and tells search engines your page hierarchy and key topics.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>ONE H1 PER PAGE:</strong> Acts as the main headline, signals primary topic</div>
<div class="bullet-point">• <strong>KEYWORD IN H1:</strong> Creates strong relevance signal vs generic headings</div>
<div class="bullet-point">• <strong>LOGICAL HIERARCHY:</strong> Use H1 → H2 → H3, never skip levels</div>
<div class="bullet-point">• <strong>DESCRIPTIVE SUBHEADINGS:</strong> Include related keywords vs generic text</div>
<div class="bullet-point">• <strong>ACCESSIBILITY:</strong> Screen readers use headings for navigation</div>

<div class="section-header">❌ AVOID</div>
<div class="code-example bad-example">&lt;h1&gt;Welcome to Our Services&lt;/h1&gt;
&lt;h2&gt;Our Process&lt;/h2&gt;</div>

<div class="section-header">📝 RECOMMENDED STRUCTURE</div>
<div class="code-example">&lt;h1&gt;${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Solutions &amp; Services&lt;/h1&gt;
&lt;h2&gt;Why Choose Our ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Expertise&lt;/h2&gt;
&lt;h3&gt;Advanced ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Technologies&lt;/h3&gt;</div>`;

        case 'Image Optimization':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Optimized images improve page speed, accessibility, and provide additional SEO signals through filenames and alt text.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>OPTIMIZE FILE SIZE:</strong> Keep under 150KB for fast loading</div>
<div class="bullet-point">• <strong>DESCRIPTIVE FILENAMES:</strong> Use keywords instead of generic names</div>
<div class="bullet-point">• <strong>DESCRIPTIVE ALT TEXT:</strong> Help screen readers and provide SEO context</div>
<div class="bullet-point">• <strong>UNDER 125 CHARACTERS:</strong> Screen readers stop around 125 chars</div>
<div class="bullet-point">• <strong>NEXT-GEN FORMATS:</strong> WebP/AVIF for better compression than JPEG/PNG</div>

<div class="section-header">❌ AVOID</div>
<div class="code-example bad-example">&lt;img src="IMG_12345.jpg" alt="image"&gt;</div>

<div class="section-header">📝 RECOMMENDED IMAGE TAG</div>
<div class="code-example">&lt;img src="${keywordSlug}-services.webp" 
     alt="${brandName} team providing ${keyword} solutions at work site" 
     width="800" height="400" loading="lazy"&gt;</div>`;

        case 'Keyword Placement':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Strategic keyword placement signals relevance to search engines while maintaining natural, readable content for users.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>FIRST 100 WORDS:</strong> Include "${keyword}" early to confirm page topic</div>
<div class="bullet-point">• <strong>IN H1 TAG:</strong> Creates the strongest relevance signal</div>
<div class="bullet-point">• <strong>IN SUBHEADINGS:</strong> Use in H2/H3 tags with related terms</div>
<div class="bullet-point">• <strong>NATURAL DENSITY:</strong> Target 1-2% keyword density naturally</div>
<div class="bullet-point">• <strong>IN IMAGE ALT TEXT:</strong> Provides additional context signals</div>

<div class="section-header">❌ AVOID KEYWORD STUFFING</div>
<div class="code-example bad-example">Our ${keyword} services are the best ${keyword} services for all your ${keyword} needs</div>

<div class="section-header">✅ NATURAL PLACEMENT</div>
<div class="code-example">We provide premier ${keyword} services with proven expertise and innovative solutions</div>

<div class="section-header">📝 TARGET LOCATIONS</div>
<div class="bullet-point">• H1: ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Solutions</div>
<div class="bullet-point">• First paragraph: Include naturally within 100 words</div>
<div class="bullet-point">• Subheadings: Advanced ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Techniques</div>
<div class="bullet-point">• Alt text: ${brandName} team performing ${keyword} analysis</div>`;

        case 'Linking':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
Strategic linking guides users to related content, keeps them engaged longer, and signals topic relevance to search engines.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>INTERNAL LINKS:</strong> Connect related pages to improve user journey</div>
<div class="bullet-point">• <strong>DESCRIPTIVE ANCHOR TEXT:</strong> Tell users and search engines what to expect</div>
<div class="bullet-point">• <strong>EXTERNAL AUTHORITY:</strong> Link to trusted sources for credibility</div>
<div class="bullet-point">• <strong>CONTEXTUAL PLACEMENT:</strong> Place naturally within content flow</div>
<div class="bullet-point">• <strong>NO BROKEN LINKS:</strong> Test regularly to maintain user experience</div>

<div class="section-header">❌ AVOID</div>
<div class="code-example bad-example">For more information &lt;a href="/page"&gt;click here&lt;/a&gt;</div>

<div class="section-header">📝 RECOMMENDED LINKING</div>
<div class="code-example">Our process incorporates the latest &lt;a href="/services/${keywordSlug}"&gt;sustainable ${keyword} techniques&lt;/a&gt; following &lt;a href="https://authority-site.com"&gt;${keyword} industry standards&lt;/a&gt;.</div>

<div class="section-header">💡 LINKING STRATEGY</div>
<div class="bullet-point">• Internal: Link to relevant service pages and case studies</div>
<div class="bullet-point">• External: Government standards, industry associations, research</div>
<div class="bullet-point">• Anchor text: Include "${keyword}" or related terms naturally</div>`;

        case 'Content':
            return `<div class="section-header">🎯 WHY IT MATTERS</div>
High-quality, comprehensive content establishes expertise, builds trust, and provides the depth search engines need to understand your authority.

<div class="section-header">✅ BEST PRACTICES</div>
<div class="bullet-point">• <strong>SUBSTANTIAL DEPTH:</strong> 1,500+ words that fully explore the topic</div>
<div class="bullet-point">• <strong>AUTHOR BYLINE:</strong> Show expertise with credible author information</div>
<div class="bullet-point">• <strong>DATA & INSIGHTS:</strong> Include specific statistics and original research</div>
<div class="bullet-point">• <strong>SCANNABLE FORMAT:</strong> Use headings, bullets, short paragraphs</div>
<div class="bullet-point">• <strong>RELEVANT MULTIMEDIA:</strong> Project photos, charts, videos vs stock images</div>

<div class="section-header">💡 CONTENT STRUCTURE</div>
<div class="code-example">1. Introduction with ${keyword} context (100-150 words)
2. Main sections with H2 subheadings
3. Case studies or examples
4. Data and statistics  
5. Conclusion with next steps</div>

<div class="section-header">📝 AUTHOR CREDIBILITY</div>
<div class="code-example">By John Smith, Lead ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Engineer at ${brandName}
15+ years experience in ${keyword} solutions</div>

<div class="section-header">📊 INCLUDE DATA EXAMPLES</div>
<div class="bullet-point">• "Our analysis shows 30% cost reduction using this method"</div>
<div class="bullet-point">• "Industry benchmarks indicate 85% success rate"</div>
<div class="bullet-point">• "Case study: Project completed 20% under budget"</div>`;

        default:
            return `Follow SEO best practices for ${keyword} optimization with user-focused, high-quality content.`;
    }
}

// Generate optimized meta description that addresses all meta description issues
function generateOptimizedMetaDescription(doc, keyword) {
    const h1 = doc.querySelector('h1');
    const title = doc.querySelector('title');
    
    // Start with keyword
    const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    let description = `${capitalizedKeyword} services`;
    
    // Add value proposition
    description += ` - Professional solutions for your business needs`;
    
    // Add specific benefit or context from page if available
    if (h1 && h1.textContent.trim()) {
        const h1Text = h1.textContent.trim().replace(new RegExp(keyword, 'gi'), '').trim();
        if (h1Text.length > 10 && h1Text.length < 50) {
            description = `${capitalizedKeyword} ${h1Text.toLowerCase()}`;
        }
    }
    
    // Add compelling middle section
    description += `. Expert ${keyword} solutions with proven results`;
    
    // Add strong CTA that includes keyword
    description += `. Get your ${keyword} consultation today!`;
    
    // Ensure it's under 160 characters
    if (description.length > 157) {
        description = `${capitalizedKeyword} services - Expert solutions with proven results. Get your consultation today!`;
    }
    
    return `<meta name="description" content="${description}">`;
} 
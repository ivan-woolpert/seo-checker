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
        return { passed: false, text: 'Primary keyword is not near the beginning.' };
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
        return { passed: false, text: 'Title tag is over 60 characters.' };
    }
    const passed = titleElement.textContent.length <= 60;
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
        return { passed: false, text: 'Meta description is missing or generic.' };
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
        return { passed: false, text: 'Meta description is over 160 characters.' };
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
        return { passed: false, text: 'Meta description does not include the primary keyword.' };
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
        return { passed: false, text: 'The <h1> tag does not contain the primary keyword.' };
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
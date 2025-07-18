# On-Page SEO Checker

A comprehensive, deterministic SEO analysis tool that evaluates web pages across 8 key categories with 40 specific checks.

## Features

- **Deterministic Analysis**: Same inputs always produce the same results
- **Comprehensive Scoring**: 40 individual SEO checks across 8 categories
- **Visual Dashboard**: Color-coded scoring and detailed results display
- **Responsive Design**: Works on desktop and mobile devices
- **Two-Column Layout**: Input controls (1/3) and results dashboard (2/3)

## How to Use

1. **Open the Application**: Open `index.html` in any modern web browser
2. **Enter Page URL**: Input the URL you want to analyze
3. **Enter Primary Keyword**: Specify the main keyword for your page
4. **Fetch & Analyze**: Click the button to automatically fetch the page source (or manually paste HTML code)
5. **Review Results**: Examine the overall score and detailed category breakdowns

## SEO Categories Analyzed

### 1. SEO-Friendly URLs (5 checks)
- Primary keyword in URL
- Short & descriptive URLs
- Hyphen word separation
- HTTPS protocol usage
- Clean, lowercase structure

### 2. Title Tag (5 checks)
- Keyword placement at beginning
- Length under 60 characters
- No keyword stuffing
- Compelling and accurate content
- Brand name inclusion

### 3. Meta Description (5 checks)
- Unique description content
- Length under 160 characters
- Ad copy writing style
- Primary keyword inclusion
- Call-to-action presence

### 4. Header Tags (5 checks)
- Single unique H1 tag
- H1 contains primary keyword
- Logical subheading structure
- Keywords in subheadings
- Proper heading hierarchy

### 5. Image Optimization (5 checks)
- Optimized file sizes
- Descriptive filenames
- Alt text presence
- Alt text length limits
- Next-gen image formats

### 6. Keyword Placement (5 checks)
- Keyword in first 100 words
- Keyword in H1 tag
- Keyword in subheadings
- Natural keyword density
- Keyword in image alt text

### 7. Linking (5 checks)
- Internal link presence
- Descriptive anchor text
- External authority links
- Contextual link placement
- No broken links

### 8. Content Quality (5 checks)
- In-depth content (1000+ words)
- Author byline/E-E-A-T
- Data and insights inclusion
- Readable formatting
- Purposeful multimedia

## Scoring System

- **Total Possible Score**: 100 points
- **Points per Check**: 2.5 points (40 checks × 2.5 = 100)
- **Color Coding**:
  - 🟢 **90-100**: Excellent (Green)
  - 🟡 **80-89.9**: Good (Yellow)
  - 🟠 **70-79.9**: Fair (Orange)
  - 🔴 **Below 70**: Poor (Red)

## Technical Notes

- **Pure HTML/CSS/JavaScript**: No external dependencies required
- **CORS Limitations**: Due to browser security, fetching may not work for all sites. Manual HTML pasting is always available.
- **Local Proxy Server**: Included `cors-proxy.py` can be run to bypass CORS restrictions completely
- **DOMParser**: Uses browser's built-in HTML parsing for reliable analysis
- **Responsive Grid**: 3-column layout on desktop, adapts to smaller screens

## Solving CORS Issues

If you get "Unable to fetch" errors, you have several options:

### Option 1: Run Local Proxy (Recommended for Developers)
```bash
python cors-proxy.py
```
This starts a local server on port 8080 that bypasses CORS restrictions.

### Option 2: Manual HTML Paste
1. Right-click on the webpage → "View Page Source" (Ctrl+U)
2. Copy all HTML code (Ctrl+A, Ctrl+C)
3. Paste into the textarea in the SEO checker
4. Click "Fetch & Analyze"

### Option 3: Browser Extension
Install a CORS browser extension like "CORS Unblock" for Chrome.

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Files Structure

```
seo-checker/
├── index.html          # Main application file
├── styles.css          # All styling and layout
├── script.js           # Analysis engine and UI logic
├── cors-proxy.py       # Local CORS proxy server (optional)
├── sample-page.html    # Sample page for testing
└── README.md           # This documentation
```

Simply open `index.html` in your browser to start using the SEO checker! 
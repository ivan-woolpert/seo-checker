#!/usr/bin/env python3
"""
Simple CORS Proxy Server for SEO Checker
Run this script to enable automatic page fetching without CORS restrictions.

Usage:
    python cors-proxy.py

Then update the SEO checker to use: http://localhost:8080/proxy?url=YOUR_URL
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import urllib.request
import urllib.error
import json

class CORSProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the request
        parsed_path = urlparse(self.path)
        
        # Handle CORS preflight
        self.send_cors_headers()
        
        if parsed_path.path == '/proxy':
            # Extract target URL from query parameters
            query_params = parse_qs(parsed_path.query)
            target_url = query_params.get('url', [None])[0]
            
            if not target_url:
                self.send_error_response(400, "Missing 'url' parameter")
                return
            
            target_url = unquote(target_url)
            
            # Ensure URL has protocol
            if not target_url.startswith(('http://', 'https://')):
                target_url = 'https://' + target_url
            
            try:
                # Fetch the target URL
                print(f"Fetching: {target_url}")
                
                # Create request with proper headers
                req = urllib.request.Request(
                    target_url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                    }
                )
                
                # Fetch content
                with urllib.request.urlopen(req, timeout=30) as response:
                    content = response.read()
                    
                    # Try to decode as UTF-8, fallback to latin-1
                    try:
                        content_str = content.decode('utf-8')
                    except UnicodeDecodeError:
                        content_str = content.decode('latin-1', errors='ignore')
                    
                    # Send successful response
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    
                    response_data = {
                        'success': True,
                        'url': target_url,
                        'content': content_str,
                        'length': len(content_str)
                    }
                    
                    self.wfile.write(json.dumps(response_data).encode('utf-8'))
                    print(f"Successfully fetched {len(content_str)} characters from {target_url}")
                    
            except urllib.error.HTTPError as e:
                print(f"HTTP Error {e.code}: {e.reason}")
                self.send_error_response(e.code, f"HTTP Error: {e.reason}")
                
            except urllib.error.URLError as e:
                print(f"URL Error: {e.reason}")
                self.send_error_response(500, f"URL Error: {e.reason}")
                
            except Exception as e:
                print(f"Unexpected error: {str(e)}")
                self.send_error_response(500, f"Unexpected error: {str(e)}")
        
        elif parsed_path.path == '/':
            # Serve a simple status page
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            
            html = """
            <!DOCTYPE html>
            <html>
            <head>
                <title>CORS Proxy Server</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .status { color: #28a745; font-weight: bold; }
                    .endpoint { background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🌐 CORS Proxy Server</h1>
                    <p class="status">✅ Server is running on port 8080</p>
                    
                    <h3>Usage:</h3>
                    <p>Use this endpoint in your SEO checker:</p>
                    <div class="endpoint">http://localhost:8080/proxy?url=YOUR_TARGET_URL</div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong> This proxy server is for local development only. 
                        Do not expose it to the internet or use it in production environments.
                    </div>
                    
                    <h3>To use with SEO Checker:</h3>
                    <ol>
                        <li>Keep this server running</li>
                        <li>Open the SEO checker application</li>
                        <li>Enter any URL and keyword</li>
                        <li>Click "Fetch & Analyze" - it should now work!</li>
                    </ol>
                    
                    <p><em>Press Ctrl+C in the terminal to stop the server.</em></p>
                </div>
            </body>
            </html>
            """
            self.wfile.write(html.encode('utf-8'))
        
        else:
            self.send_error_response(404, "Not Found")
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_cors_headers()
        self.send_response(200)
        self.end_headers()
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
    
    def send_error_response(self, code, message):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        
        error_data = {
            'success': False,
            'error': message,
            'code': code
        }
        
        self.wfile.write(json.dumps(error_data).encode('utf-8'))
    
    def log_message(self, format, *args):
        # Custom logging to make it cleaner
        print(f"[{self.date_time_string()}] {format % args}")

def run_proxy_server(port=8080):
    server_address = ('localhost', port)
    httpd = HTTPServer(server_address, CORSProxyHandler)
    
    print("=" * 60)
    print("🌐 CORS Proxy Server for SEO Checker")
    print("=" * 60)
    print(f"✅ Server running on http://localhost:{port}")
    print(f"📋 Status page: http://localhost:{port}/")
    print(f"🔗 Proxy endpoint: http://localhost:{port}/proxy?url=YOUR_URL")
    print()
    print("💡 Now you can use the SEO Checker without CORS restrictions!")
    print("   Just click 'Fetch & Analyze' and it should work automatically.")
    print()
    print("⏹️  Press Ctrl+C to stop the server")
    print("=" * 60)
    print()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down proxy server...")
        httpd.server_close()
        print("✅ Server stopped successfully!")

if __name__ == '__main__':
    run_proxy_server() 
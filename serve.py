"""Local dev server for Make-a-Ring. Usage: python serve.py [port]

Plain `python -m http.server` can serve .js as text/plain on Windows, which browsers
refuse for ES modules, so the MIME types are pinned here.
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"Make-a-Ring running at http://localhost:{PORT}")
        httpd.serve_forever()

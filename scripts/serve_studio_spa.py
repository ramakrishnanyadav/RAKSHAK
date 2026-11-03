"""
Single Page Application (SPA) HTTP Server for ADAPTIVE-PATH Studio.
Serves static assets from studio/dist and routes all client-side paths (/demo, /benchmarks, etc.) to index.html.
"""

import os
import sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, HTTPServer

DIST_DIR = Path(__file__).resolve().parent.parent / "studio" / "dist"
PORT = 5173


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        full_path = self.translate_path(self.path)
        # If path does not exist on disk or is a directory without index.html, serve /index.html
        if not os.path.exists(full_path) or (os.path.isdir(full_path) and not os.path.exists(os.path.join(full_path, "index.html"))):
            self.path = "/index.html"
        return super().do_GET()


def main():
    if not DIST_DIR.exists():
        print(f"[!] Error: {DIST_DIR} not found. Run npm run build first.")
        sys.exit(1)

    server = HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"[+] ADAPTIVE-PATH Studio SPA serving at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    main()

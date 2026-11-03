"""Serve browser app files without Vite or access to node_modules/.git."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if not path.startswith('/preview/'):
            self.send_error(404)
            return
        relative = path[len('/preview/'):]
        if '..' in relative.split('/') or not (
            relative in ('', 'index.html') or relative.startswith(('src/', 'public/'))
        ):
            self.send_error(404)
            return
        self.path = '/' + relative
        super().do_GET()


ThreadingHTTPServer(('127.0.0.1', 8081), Preview).serve_forever()

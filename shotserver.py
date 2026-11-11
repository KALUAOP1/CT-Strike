import http.server, base64, os, re, sys
OUT = os.path.dirname(os.path.abspath(__file__))
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n).decode("utf-8", "ignore")
        m = re.match(r"data:image/(\w+);base64,(.*)", body, re.S)
        if not m:
            self.send_response(400); self.end_headers(); return
        name = self.headers.get("X-Name", "shot")
        ext = "jpg" if m.group(1) in ("jpeg", "jpg") else m.group(1)
        with open(os.path.join(OUT, name + "." + ext), "wb") as f:
            f.write(base64.b64decode(m.group(2)))
        self.send_response(200); self._cors(); self.end_headers()
        self.wfile.write(b"ok")
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", 8742), H).serve_forever()

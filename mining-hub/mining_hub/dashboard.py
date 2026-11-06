"""Local dashboard on 127.0.0.1 (standard library only, no CDN, no outside calls).

Protection against websites in your browser poking the hub:
  * Host header must be 127.0.0.1/localhost:<port> (blocks DNS rebinding).
  * Every /api call needs the X-Hub-Token header, a random value generated at
    startup and only embedded in the page served from this origin. A foreign
    site cannot read it, and a custom header forces a CORS preflight that the
    hub never approves (blocks cross-site request forgery).
"""
from __future__ import annotations

import json
import logging
import secrets
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

log = logging.getLogger("mining_hub")
PAGE = (Path(__file__).parent / "dashboard.html").read_text(encoding="utf-8")


def make_server(hub, host: str = "127.0.0.1", port: int = 8080, token: str | None = None) -> ThreadingHTTPServer:
    token = token or secrets.token_urlsafe(24)

    class Handler(BaseHTTPRequestHandler):
        server_version = "MiningHub"
        sys_version = ""

        def log_message(self, fmt, *args):  # quiet; route to our logger at debug level
            log.debug("http %s - %s", self.address_string(), fmt % args)

        def _host_ok(self) -> bool:
            actual_port = self.server.server_address[1]
            allowed = {f"127.0.0.1:{actual_port}", f"localhost:{actual_port}", f"[::1]:{actual_port}"}
            return (self.headers.get("Host") or "").lower() in allowed

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy",
                             "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
                             "connect-src 'self'; img-src data:; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code: int, doc) -> None:
            self._send(code, json.dumps(doc).encode(), "application/json")

        def _guard(self, api: bool) -> bool:
            if not self._host_ok():
                self._json(HTTPStatus.FORBIDDEN, {"error": "bad host"})
                return False
            if api and not secrets.compare_digest(self.headers.get("X-Hub-Token") or "", token):
                self._json(HTTPStatus.FORBIDDEN, {"error": "missing or wrong token"})
                return False
            return True

        def do_GET(self):  # noqa: N802
            path = self.path.split("?", 1)[0]
            if path == "/":
                if self._guard(api=False):
                    self._send(200, PAGE.replace("__HUB_TOKEN__", token).encode(), "text/html; charset=utf-8")
            elif path == "/api/status":
                if self._guard(api=True):
                    self._json(200, hub.status())
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):  # noqa: N802
            if not self._guard(api=True):
                return
            length = min(int(self.headers.get("Content-Length") or 0), 4096)
            try:
                body = json.loads(self.rfile.read(length) or b"{}") if length else {}
            except ValueError:
                return self._json(400, {"error": "bad json"})
            path = self.path.split("?", 1)[0]
            actions = {
                "/api/start": hub.start,
                "/api/stop": hub.stop,
                "/api/emergency": lambda: hub.emergency_stop("Emergency stop pressed on the dashboard"),
                "/api/reset": hub.reset_emergency,
                "/api/profile": lambda: hub.set_profile(str(body.get("profile", ""))),
            }
            fn = actions.get(path)
            if fn is None:
                return self._json(404, {"error": "not found"})
            ok, msg = fn()
            self._json(200 if ok else 409, {"ok": ok, "message": msg})

        def do_OPTIONS(self):  # noqa: N802 - never approve a CORS preflight
            self._json(HTTPStatus.FORBIDDEN, {"error": "cross-origin requests are not allowed"})

    server = ThreadingHTTPServer((host, port), Handler)
    server.daemon_threads = True
    server.hub_token = token  # type: ignore[attr-defined]
    return server


def serve_in_background(server: ThreadingHTTPServer) -> threading.Thread:
    t = threading.Thread(target=server.serve_forever, name="dashboard", daemon=True)
    t.start()
    return t

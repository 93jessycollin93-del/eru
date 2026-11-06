"""A stand-in miner process for tests: prints its --user argument (to test log
redaction) and serves a lolMiner-shaped JSON API on 127.0.0.1."""
import argparse
import json
import signal
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

ap = argparse.ArgumentParser()
ap.add_argument("--user", default="")
ap.add_argument("--apiport", type=int, required=True)
ap.add_argument("--ignore-term", action="store_true")
ap.add_argument("--exit-after", type=float, default=0)
args = ap.parse_args()

if args.ignore_term:
    for name in ("SIGTERM", "SIGBREAK", "SIGINT"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), signal.SIG_IGN)

DOC = {
    "Algorithms": [{"Algorithm": "Etchash", "Total_Performance": 121.5, "Performance_Unit": "Mh/s",
                    "Total_Accepted": 12, "Total_Rejected": 1}],
    "Workers": [{"Index": 0, "Name": "RTX 3090", "Power": 241.0, "Core_Temp": 61, "Mem_Temp": 84}],
}


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(DOC).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


srv = HTTPServer(("127.0.0.1", args.apiport), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
print(f"fake miner connecting as {args.user}", flush=True)
start = time.time()
while True:
    time.sleep(0.1)
    if args.exit_after and time.time() - start > args.exit_after:
        sys.exit(3)

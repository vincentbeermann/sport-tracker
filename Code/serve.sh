#!/bin/bash
# Sport Tracker - local static server for first-time install on phone.
#
# Usage:
#   ./serve.sh
#
# Then on your iPhone (same Wi-Fi):
#   open the printed URL in Safari → tap Share → Add to Home Screen.
# After that, the app is installed and runs offline. You can stop this server.

set -e
cd "$(dirname "$0")/public"

PORT=3001
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                  SPORT TRACKER                         ║"
echo "║                                                        ║"
echo "║   Mac:    http://localhost:$PORT                          ║"
printf  "║   Phone:  http://%-37s  ║\n" "$IP:$PORT"
echo "║                                                        ║"
echo "║   Open the Phone URL in Safari → Share → Add to       ║"
echo "║   Home Screen. After that, the app runs offline       ║"
echo "║   and you can stop this server (Ctrl+C).              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

exec python3 -m http.server "$PORT"

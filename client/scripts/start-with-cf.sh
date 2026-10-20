#!/usr/bin/env bash
# Corp Wi‑Fi often blocks phone ↔ Mac LAN. This starts Cloudflare quick tunnels
# for Metro (:8081) and the API (:8000), then launches Expo with the packager proxy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
PATH="/opt/homebrew/opt/node@26/bin:$PATH"
export PATH

need() { command -v "$1" >/dev/null || { echo "Missing $1. brew install cloudflared"; exit 1; }; }
need cloudflared
need curl

mkdir -p /tmp/koober-tunnels
API_LOG=/tmp/koober-tunnels/api.log
METRO_LOG=/tmp/koober-tunnels/metro.log

pkill -f "cloudflared tunnel --url http://127.0.0.1:8000" 2>/dev/null || true
pkill -f "cloudflared tunnel --url http://127.0.0.1:8081" 2>/dev/null || true
sleep 1

cloudflared tunnel --url http://127.0.0.1:8000 --protocol http2 --metrics 127.0.0.1:20241 >"$API_LOG" 2>&1 &
cloudflared tunnel --url http://127.0.0.1:8081 --protocol http2 --metrics 127.0.0.1:20242 >"$METRO_LOG" 2>&1 &

pick_url() {
  local log=$1 i url
  for i in $(seq 1 30); do
    url=$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$log" 2>/dev/null | head -1 || true)
    if [[ -n "${url:-}" ]]; then echo "$url"; return 0; fi
    sleep 1
  done
  return 1
}

API_URL=$(pick_url "$API_LOG")
METRO_URL=$(pick_url "$METRO_LOG")
echo "API tunnel:   $API_URL"
echo "Metro tunnel: $METRO_URL"

# Wait until origins respond through CF
for i in $(seq 1 15); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 5 "$API_URL/docs" || echo 0)
  [[ "$code" == "200" ]] && break
  sleep 1
done

# Point the app at the public API
cat >"$ROOT/.env" <<EOF
EXPO_PUBLIC_API_URL=$API_URL
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
EOF

if [[ -f "$REPO/server/.env" ]]; then
  python3 - <<PY
from pathlib import Path
import re
api, metro = "$API_URL", "$METRO_URL"
p = Path("$REPO/server/.env")
text = p.read_text()
text = re.sub(r"^APP_BASE_URL=.*$", f"APP_BASE_URL={api}", text, flags=re.M)
m = re.search(r"^CORS_ORIGINS=(.*)$", text, flags=re.M)
origins = m.group(1) if m else ""
base = [o.strip() for o in origins.split(",") if o.strip() and "trycloudflare.com" not in o]
base += [api, metro]
text = re.sub(r"^CORS_ORIGINS=.*$", "CORS_ORIGINS=" + ",".join(base), text, flags=re.M)
p.write_text(text)
PY
fi

echo ""
echo "In Expo Go → Enter URL manually:"
echo "  exp://${METRO_URL#https://}:443"
echo ""

cd "$ROOT"
export EXPO_PACKAGER_PROXY_URL="$METRO_URL"
export REACT_NATIVE_PACKAGER_HOSTNAME="${METRO_URL#https://}"
exec npx expo start --lan

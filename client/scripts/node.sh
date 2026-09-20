#!/usr/bin/env bash
# Prefer Homebrew Node 26 (Expo requires >= 20.19.4). Falls back to PATH.
set -euo pipefail
if [ -x /opt/homebrew/opt/node@26/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@26/bin:$PATH"
fi
exec node "$@"

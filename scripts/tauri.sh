#!/usr/bin/env bash
set -euo pipefail

# The sidecar is gitignored, so a checkout can leave an old server binary next
# to a new desktop UI. Keep local dev contract-aligned; cross-target/release
# builds already build their requested engine explicitly.
if [ "${1:-}" = "dev" ]; then
  bash "$(dirname "$0")/build-engine.sh"
fi

exec pnpm exec tauri "$@"

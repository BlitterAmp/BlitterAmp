#!/usr/bin/env bash
# Builds the BlitterServer engine as a Tauri sidecar for a given target.
#
#   scripts/build-engine.sh                            # host target (dev)
#   scripts/build-engine.sh x86_64-pc-windows-msvc     # cross-compile for release
#
# The engine is pure Go (modernc SQLite, ffmpeg is external), so it
# cross-compiles with CGO off — no C toolchain needed. The desktop app talks to
# the engine's JSON admin API, not its embedded admin SPA, so we skip the web
# build entirely. Output is gitignored (built, not committed).
set -euo pipefail

triple="${1:-$(rustc -vV | sed -n 's/host: //p')}"
server_dir="${BLITTERSERVER_DIR:-$(cd "$(dirname "$0")/../../blitterserver" && pwd)}"

if [ -n "${BLITTERSERVER_SHA:-}" ]; then
  actual_sha="$(git -C "$server_dir" rev-parse HEAD)"
  if [ "$actual_sha" != "$BLITTERSERVER_SHA" ]; then
    echo "build-engine: BlitterServer checkout is $actual_sha, expected $BLITTERSERVER_SHA" >&2
    exit 1
  fi
fi

case "$triple" in
  aarch64-apple-darwin)      goos=darwin;  goarch=arm64 ;;
  x86_64-apple-darwin)       goos=darwin;  goarch=amd64 ;;
  x86_64-unknown-linux-gnu)  goos=linux;   goarch=amd64 ;;
  aarch64-unknown-linux-gnu) goos=linux;   goarch=arm64 ;;
  x86_64-pc-windows-msvc)    goos=windows; goarch=amd64 ;;
  *) echo "build-engine: unsupported target triple '$triple'" >&2; exit 1 ;;
esac

ext=""
[ "$goos" = windows ] && ext=".exe"
out="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries/blitterserver-${triple}${ext}"
mkdir -p "$(dirname "$out")"

version="${BLITTERSERVER_VERSION:-$(cd "$server_dir" && git describe --tags --always --dirty 2>/dev/null || echo dev)}"

echo "Building BlitterServer engine (${goos}/${goarch}) from ${server_dir}…"
( cd "$server_dir" && CGO_ENABLED=0 GOOS="$goos" GOARCH="$goarch" \
    go build -ldflags "-X main.version=${version}" -o "$out" ./cmd/blitterserver )
echo "Sidecar ready: ${out}"

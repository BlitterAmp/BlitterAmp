#!/usr/bin/env bash
# Builds the BlitterServer engine binary and places it as a Tauri sidecar for
# the host target triple. Run before `pnpm tauri dev` / `build` on a fresh
# clone; the binary is gitignored (built, not committed).
set -euo pipefail

server_dir="${BLITTERSERVER_DIR:-$(cd "$(dirname "$0")/../../blitterserver" && pwd)}"
triple="$(rustc -vV | sed -n 's/host: //p')"
out="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries/blitterserver-${triple}"

echo "Building BlitterServer engine from ${server_dir}…"
( cd "$server_dir" && make build >/dev/null )
mkdir -p "$(dirname "$out")"
cp "$server_dir/dist/blitterserver" "$out"
echo "Sidecar ready: ${out}"

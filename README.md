# BlitterAmp Desktop

The desktop player for your [BlitterServer](https://github.com/BlitterAmp/BlitterServer) — your music,
on your server, in a native app. Tauri + React + DaisyUI; the successor to musex's Electron player.

**Status: functional player.** On first launch BlitterAmp starts its own bundled BlitterServer engine —
no setup, no server to run — points it at `~/Music/BlitterAmp`, scans, and you're playing. If you already
run a BlitterServer, connect to it under Settings → Connection (PIN pairing).

Features: Home with server-composed rails and mixes; browse albums/artists/tracks with an artist page;
federated search; a real play queue (shuffle/repeat/volume, up-next, add/play-next); playlists
(create/edit, add/remove, the auto Loved Tracks list); inline loves and star ratings; per-track radio;
theme picker with custom themes. Native playback supports gapless flac/mp3/aac/alac/vorbis/wav, with
an honest limitation for Opus. The local metadata/art cache stays current through server deltas and
SSE. Personal last.fm connection and scrobbling work per profile; manage the library, profiles,
devices, and server-wide integrations natively under Settings.

## Development

BlitterAmp builds the bundled BlitterServer engine from a sibling checkout. Clone both repositories
into the same parent directory:

```text
BlitterAmp/
|-- blitteramp/
`-- blitterserver/
```

Set `BLITTERSERVER_DIR` to the server checkout if you use a different layout.

### Common requirements

- [Node.js 22](https://nodejs.org/) and [pnpm 11](https://pnpm.io/installation)
- [Go 1.26.4 or newer](https://go.dev/doc/install), as required by BlitterServer's `go.mod`
- The stable Rust toolchain installed with [rustup](https://rustup.rs/)
- Git and Bash (the sidecar and Tauri wrapper scripts are Bash scripts)
- `ffmpeg` on `PATH` for BlitterServer transcoding

After installing rustup, make sure a toolchain is selected:

```sh
rustup default stable
```

#### Linux

Install Tauri's WebKit/GTK dependencies and the ALSA development headers used by native audio. On
Debian or Ubuntu:

```sh
sudo apt update
sudo apt install build-essential curl wget file \
  libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev libasound2-dev patchelf ffmpeg
```

Package names differ on other distributions; use the
[Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux) for the equivalent
WebKit/GTK packages and also install ALSA development headers and `ffmpeg`.

On Wayland with an NVIDIA driver, BlitterAmp automatically disables WebKitGTK's incompatible
DMA-BUF renderer before the UI starts. Set `BLITTERAMP_FORCE_DMABUF_RENDERER=1` to bypass that
default, or set `WEBKIT_DISABLE_DMABUF_RENDERER` explicitly to manage WebKit's setting yourself.

#### macOS

Install Xcode Command Line Tools and `ffmpeg`:

```sh
xcode-select --install
brew install ffmpeg
```

Building signed and notarized release bundles requires full Xcode plus Apple signing credentials;
local development and unsigned desktop builds only require the Command Line Tools.

#### Windows

Install the following:

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the
  **Desktop development with C++** workload
- Microsoft Edge WebView2 Runtime (already present on current Windows 10 and Windows 11 systems)
- [Git for Windows](https://git-scm.com/download/win), including Git Bash on `PATH`
- `ffmpeg` on `PATH`

Select Rust's MSVC toolchain from PowerShell or Git Bash:

```sh
rustup default stable-msvc
```

Run the development commands below from Git Bash. MSI bundle creation may also require Windows'
optional VBSCRIPT feature because `tauri.conf.json` builds all bundle targets.

### Install and run

From the `blitteramp` checkout:

```sh
pnpm install --frozen-lockfile
pnpm tauri dev     # rebuild the bundled engine from ../blitterserver, then run
pnpm test          # unit tests
pnpm typecheck     # TypeScript type checking
pnpm build         # typecheck + production frontend build
pnpm engine:build  # build only the host-specific BlitterServer sidecar
pnpm gen:api       # regenerate contract types from ../blitterserver
```

To verify the native Rust host after building the sidecar:

```sh
pnpm engine:build
cargo check --manifest-path src-tauri/Cargo.toml
```

Build native installers for the current platform with `pnpm tauri build`. Tauri desktop bundles are
built on their target operating system; the release workflow builds Linux, macOS, and Windows in a
platform matrix.

## License

MIT

# BlitterAmp Desktop

The desktop player for your [BlitterServer](https://github.com/BlitterAmp/BlitterServer) — your music,
on your server, in a native app. Tauri + React; the successor to musex's Electron player.

**Status: early arcs.** On first launch BlitterAmp starts its own bundled BlitterServer engine — no
setup, no server to run — so you just pick your music folder and play. If you already run a BlitterServer,
it connects to that instead (Settings → Connection → Connect, PIN pairing approved in its web admin).
Manage your library, profiles, devices, and integrations natively under Settings. Browse albums/artists and play;
playback uses the system webview (flac/mp3/m4a) with the mpv engine for gapless everything as the next arc.

## Development

Requires node + pnpm and the Rust toolchain (Tauri v2).

```sh
pnpm install
pnpm engine:build  # build the bundled BlitterServer sidecar (needs ../blitterserver + Go)
pnpm tauri dev     # run
pnpm test          # unit tests
pnpm build         # typecheck + frontend build
pnpm gen:api       # regenerate contract types from ../blitterserver
```

## License

MIT

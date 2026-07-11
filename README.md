# BlitterAmp Desktop

The desktop player for your [BlitterServer](https://github.com/BlitterAmp/BlitterServer) — your music,
on your server, in a native app. Tauri + React; the successor to musex's Electron player.

**Status: first arc.** Connect to a BlitterServer (PIN pairing approved in its web admin), pick a
household profile, browse albums/artists, and play. Playback currently uses the system webview
(flac/mp3/m4a); the mpv engine for gapless everything is the next arc, followed by the bundled
BlitterServer engine for zero-setup desktop use.

## Development

Requires node + pnpm and the Rust toolchain (Tauri v2).

```sh
pnpm install
pnpm tauri dev     # run against a live BlitterServer
pnpm test          # unit tests
pnpm build         # typecheck + frontend build
pnpm gen:api       # regenerate contract types from ../blitterserver
```

## License

MIT

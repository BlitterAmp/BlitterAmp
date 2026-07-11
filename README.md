# BlitterAmp Desktop

The desktop player for your [BlitterServer](https://github.com/BlitterAmp/BlitterServer) — your music,
on your server, in a native app. Tauri + React + DaisyUI; the successor to musex's Electron player.

**Status: functional player.** On first launch BlitterAmp starts its own bundled BlitterServer engine —
no setup, no server to run — points it at `~/Music/BlitterAmp`, scans, and you're playing. If you already
run a BlitterServer, connect to it under Settings → Connection (PIN pairing).

Features: Home with server-composed rails and mixes; browse albums/artists/tracks with an artist page;
federated search; a real play queue (shuffle/repeat/volume, up-next, add/play-next); playlists
(create/edit, add/remove, the auto Loved Tracks list); inline loves and star ratings; per-track radio;
theme picker with custom themes. Playback uses the system webview (flac/mp3/m4a); the mpv engine for
gapless ogg/opus is a later arc, as is SSE live-updates and personal last.fm scrobbling. Manage the
library, profiles, devices, and integrations natively under Settings.

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

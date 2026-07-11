# BlitterAmp Desktop — Project Instructions

The desktop player for **BlitterAmp** — the successor to musex's Electron desktop app (`~/src/musex`
holds the accumulated platform history in its CLAUDE.md). The app talks ONLY to a
[BlitterServer](https://github.com/BlitterAmp/BlitterServer) instance; there is no Plex, Lidarr, or
last.fm code in this repo — the server owns all of that behind its contract.

## Where the design lives (POLICY — same regime as BlitterServer, decided 2026-07-10)

Architecture design, specs, plans, and decision history live in the AgentOS vault
(`~/Documents/Vaults/AgentOS/Apps/BlitterAmp/`). This repo carries only current implementation and
operational docs. Do not add design docs here.

## Stack (decided 2026-07-11)

- **Tauri v2** (chosen over Electron: musex only used Chromium for UI — playback was an mpv sidecar,
  and Tauri sidecars fit both mpv and the future embedded BlitterServer engine; ~10 MB vs ~150 MB).
- **React 19 + TypeScript + Vite** in the webview (matches the musex UI being ported and the
  React Native mobile app; the BlitterServer *admin console* is Svelte and stays that way — they share
  only the contract).
- The Rust host stays THIN: window/plugin/sidecar lifecycle only, PLUS the bundled-engine manager
  (`src-tauri/src/engine.rs`) — it spawns a BlitterServer sidecar, auto-provisions it (all admin-cookie
  work is Rust-side because the webview can't read Set-Cookie), and hands the app a bearer profile token.
  App logic lives in React; music logic lives in BlitterServer.
- Design system: `src/theme.css` — ported musex tokens/classes (dark shell, green/purple brand).
  Reuse its class vocabulary before inventing new styles.

## Non-negotiables

- **Contract-first client.** `src/api/schema.d.ts` is generated (`pnpm gen:api`) from BlitterServer's
  `api/openapi.yaml`. Never hand-write response shapes; regenerate when the contract changes.
- **Always connected, no sign-in gate.** The app defaults to its bundled local engine (like a native
  music app) and only connects to a remote BlitterServer if the user opts in via Settings. Signing out
  of a remote returns to local — it never lands on a login screen. `src/state/connection.ts` resolves
  the connection on launch (`local` | `remote`); a remote uses PIN-pairing (URL → code → approve in that
  server's web admin → profile), persisted in `session.json`.
- **Management is local-only.** The desktop app is the ADMIN of its bundled engine (Rust holds the
  password), so native Settings can manage source/profiles/devices/integrations via the `engine_admin`
  Rust proxy (`src/admin/adminClient.ts`). A paired *remote* server is administered in its own web
  console — the desktop app is just a player there.
- **Playback honesty:** the webview `<audio>` engine (stream grants) cannot play ogg/opus on WKWebView.
  The UI must say so, not fail silently. The mpv sidecar engine (ports musex's) is the planned fix.
- API calls go through `@tauri-apps/plugin-http` (webview CORS can't reach arbitrary self-hosted
  servers); artwork loads through the authed client into object URLs (img tags can't carry bearers).

## Commands

- `pnpm test` — vitest; `pnpm exec tsc --noEmit` — typecheck; `pnpm build` — typecheck + vite build.
- `pnpm tauri dev` — run the app against a live BlitterServer (dev proxy in vite.config.ts).
- `pnpm tauri build` — package; `--debug --no-bundle` for a quick real-binary compile check.
- `pnpm gen:api` — regenerate the contract types (needs ../blitterserver checked out).
- `pnpm engine:build` — build the BlitterServer sidecar for this host (needs ../blitterserver + Go).
  Required before `pnpm tauri dev/build` on a fresh clone.

## Layout

- `src/api/` — generated schema + `client.ts` (typed fetch wrapper, ApiError, art cache).
- `src/state/session.ts` — server URL + tokens, persisted; restore-on-launch.
- `src/audio/player.ts` — webview audio engine (queue, grants, container gating).
- `src/ui/` — Shell (frameless topbar/sidebar/now-playing), `Settings.tsx` + `settings/` (Connection,
  Library, Profiles, Devices, Integrations panes; `ConnectRemote` is the pair-to-remote wizard), `views/`.
- `src-tauri/` — Rust host: plugins (store, http, opener, shell, dialog), capabilities, and the
  bundled-engine manager (`engine.rs`).
- `src-tauri/binaries/blitterserver-<triple>` — the engine sidecar, built (not committed) via
  `pnpm engine:build`; gitignored.

## Git workflow

Remote: `https://github.com/BlitterAmp/BlitterAmp`. Feature branches + PRs, conventional-commit titles,
squash-merge. `git add -A`; push after every commit; tests + typecheck green before push.

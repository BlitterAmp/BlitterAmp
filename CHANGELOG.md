# Changelog

## [0.2.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.1.0...v0.2.0) (2026-07-12)


### ⚠ BREAKING CHANGES

* **ui:** rebuild the interface on Tailwind v4 + DaisyUI ([#4](https://github.com/BlitterAmp/BlitterAmp/issues/4))

### Features

* About window with cross-ecosystem acknowledgements ([#14](https://github.com/BlitterAmp/BlitterAmp/issues/14)) ([a0e8372](https://github.com/BlitterAmp/BlitterAmp/commit/a0e8372e4e043933f717bd2a48bcd83fc0cea12b))
* always-connected app + native Settings, frameless window, Preferences (⌘,) ([#3](https://github.com/BlitterAmp/BlitterAmp/issues/3)) ([6313bc0](https://github.com/BlitterAmp/BlitterAmp/commit/6313bc031399ca2f4bd83300067a19b4d1a38f80))
* artist pages, tracks view, context menus, inline loves + star ratings ([#9](https://github.com/BlitterAmp/BlitterAmp/issues/9)) ([5759a03](https://github.com/BlitterAmp/BlitterAmp/commit/5759a033d90a4d7848229837a5fc9239a93cc660))
* **audio:** native rodio playback engine with gapless + preload ([#13](https://github.com/BlitterAmp/BlitterAmp/issues/13)) ([2b7fc3f](https://github.com/BlitterAmp/BlitterAmp/commit/2b7fc3fe83cac491d96e984897f7a2a3a249503a))
* BlitterAmp desktop — Tauri scaffold with BlitterServer pairing, browse, and playback ([2c873ca](https://github.com/BlitterAmp/BlitterAmp/commit/2c873ca328ce50e0a78fcfc176f067c225ced551))
* bundle and auto-provision a BlitterServer engine when none is running ([#2](https://github.com/BlitterAmp/BlitterAmp/issues/2)) ([4c8ada2](https://github.com/BlitterAmp/BlitterAmp/commit/4c8ada2fc2b27b8ccfff799568b061d8e878b903))
* desktop build + release pipeline (release-please, signing, auto-update) ([#15](https://github.com/BlitterAmp/BlitterAmp/issues/15)) ([9c78a07](https://github.com/BlitterAmp/BlitterAmp/commit/9c78a07ed878d23436a3f32fc9ca9d53b68d68a5))
* Home, search, and mixes — discovery views ([#11](https://github.com/BlitterAmp/BlitterAmp/issues/11)) ([9022cbd](https://github.com/BlitterAmp/BlitterAmp/commit/9022cbd518adfbc05c780931c298b1610b4e837c))
* per-track radio ('Start radio'); README to the full feature set ([#12](https://github.com/BlitterAmp/BlitterAmp/issues/12)) ([c2376dd](https://github.com/BlitterAmp/BlitterAmp/commit/c2376ddde4831c383520f66bb95702541cfbf977))
* **player:** reactive queue, shuffle/repeat/volume, and playback reporting ([#6](https://github.com/BlitterAmp/BlitterAmp/issues/6)) ([a17c8f6](https://github.com/BlitterAmp/BlitterAmp/commit/a17c8f6eb11cb2e328f2359a6e807850d295b975))
* playlists — sidebar, playlist view, create/rename/delete, add/remove tracks ([#10](https://github.com/BlitterAmp/BlitterAmp/issues/10)) ([d3c8f8d](https://github.com/BlitterAmp/BlitterAmp/commit/d3c8f8ddf87ae56990862514f544787e49f74f16))
* **ui:** theme picker with all DaisyUI themes + user-defined custom themes ([#5](https://github.com/BlitterAmp/BlitterAmp/issues/5)) ([6df97a1](https://github.com/BlitterAmp/BlitterAmp/commit/6df97a1775b3123e2bc1f69c2b57874b977bb307))


### Bug Fixes

* allow the engine's dynamic port in the HTTP scope; default library to ~/Music/BlitterAmp ([#7](https://github.com/BlitterAmp/BlitterAmp/issues/7)) ([995d1b3](https://github.com/BlitterAmp/BlitterAmp/commit/995d1b360e1c6e86ea02075f0093fe67b6dc3034))
* auto-connect — probe the local server, restore mid-flow pairings, retry transient restores ([#1](https://github.com/BlitterAmp/BlitterAmp/issues/1)) ([d65c990](https://github.com/BlitterAmp/BlitterAmp/commit/d65c99005520810190a45b38a9641e1927b2708a))
* live-refresh browse views while the library scans; verify playback path ([#8](https://github.com/BlitterAmp/BlitterAmp/issues/8)) ([054dc19](https://github.com/BlitterAmp/BlitterAmp/commit/054dc192599227f43f430b2723b66305fa32ea3b))


### Code Refactoring

* **ui:** rebuild the interface on Tailwind v4 + DaisyUI ([#4](https://github.com/BlitterAmp/BlitterAmp/issues/4)) ([548292a](https://github.com/BlitterAmp/BlitterAmp/commit/548292af140d9171385e22bc600c71f4189f583c))

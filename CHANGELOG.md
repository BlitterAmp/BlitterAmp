# Changelog

## [0.5.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.4.0...v0.5.0) (2026-07-12)


### Features

* configure fanart.tv artwork enrichment ([#25](https://github.com/BlitterAmp/BlitterAmp/issues/25)) ([82e8523](https://github.com/BlitterAmp/BlitterAmp/commit/82e852328a5a659754705f8ed501a9337f917bbb))
* connect personal last.fm accounts ([#26](https://github.com/BlitterAmp/BlitterAmp/issues/26)) ([96b1850](https://github.com/BlitterAmp/BlitterAmp/commit/96b18500e1887cb45a728521ceb021a8a3b7fed0))
* **library:** full local cache + delta sync (desktop) ([#21](https://github.com/BlitterAmp/BlitterAmp/issues/21)) ([ace8020](https://github.com/BlitterAmp/BlitterAmp/commit/ace8020f2a4d17b6244b9a0a1224fc1c9b0a0c13))
* **ui:** playlist creation, play/shuffle/queue actions, mosaic art, shuffle modes ([#24](https://github.com/BlitterAmp/BlitterAmp/issues/24)) ([4d4d4ec](https://github.com/BlitterAmp/BlitterAmp/commit/4d4d4ec1379bb510efa3217b7bf0c159b0addc26))


### Bug Fixes

* rebuild bundled engine before Tauri dev ([#28](https://github.com/BlitterAmp/BlitterAmp/issues/28)) ([1bb29fd](https://github.com/BlitterAmp/BlitterAmp/commit/1bb29fd58571e95e5605d34b0e5bb7bb08f76c7f))


### Performance Improvements

* **library:** virtualize the track list; keep browse views alive; lazy art ([#23](https://github.com/BlitterAmp/BlitterAmp/issues/23)) ([5eeb0e2](https://github.com/BlitterAmp/BlitterAmp/commit/5eeb0e20a02e25e99b17039cd57b665d963c9b67))

## [0.4.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.3.0...v0.4.0) (2026-07-12)


### Features

* use the musex app icon for BlitterAmp ([#18](https://github.com/BlitterAmp/BlitterAmp/issues/18)) ([274ab2d](https://github.com/BlitterAmp/BlitterAmp/commit/274ab2d6ce3f4185da7a56eed588f7aebb3435ab))

## [0.3.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.2.0...v0.3.0) (2026-07-12)


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
* **ci:** let tauri-action create the release if missing ([9ca0edd](https://github.com/BlitterAmp/BlitterAmp/commit/9ca0edd68f32a4985cfa6ef9681b72e0fd79f3f3))
* live-refresh browse views while the library scans; verify playback path ([#8](https://github.com/BlitterAmp/BlitterAmp/issues/8)) ([054dc19](https://github.com/BlitterAmp/BlitterAmp/commit/054dc192599227f43f430b2723b66305fa32ea3b))


### Code Refactoring

* **ui:** rebuild the interface on Tailwind v4 + DaisyUI ([#4](https://github.com/BlitterAmp/BlitterAmp/issues/4)) ([548292a](https://github.com/BlitterAmp/BlitterAmp/commit/548292af140d9171385e22bc600c71f4189f583c))

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

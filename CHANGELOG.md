# Changelog

## [0.7.1](https://github.com/BlitterAmp/BlitterAmp/compare/v0.7.0...v0.7.1) (2026-07-15)


### Bug Fixes

* publish desktop compatibility metadata ([#61](https://github.com/BlitterAmp/BlitterAmp/issues/61)) ([8016d35](https://github.com/BlitterAmp/BlitterAmp/commit/8016d3549d091de39867187cabbae778e88e5cd5))

## [0.7.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.6.0...v0.7.0) (2026-07-15)


### Features

* add personalized mixes and coordinated releases ([#57](https://github.com/BlitterAmp/BlitterAmp/issues/57)) ([bf89d57](https://github.com/BlitterAmp/BlitterAmp/commit/bf89d57d95f681b3829fd82decb73f33326892ce))


### Bug Fixes

* dispatch releases across repositories ([#59](https://github.com/BlitterAmp/BlitterAmp/issues/59)) ([9e846ba](https://github.com/BlitterAmp/BlitterAmp/commit/9e846ba04f92be9d1655264a4a385b3f1b579bd8))

## [0.6.0](https://github.com/BlitterAmp/BlitterAmp/compare/v0.5.0...v0.6.0) (2026-07-15)


### Features

* add combined diagnostic log viewer ([#29](https://github.com/BlitterAmp/BlitterAmp/issues/29)) ([ffb88bb](https://github.com/BlitterAmp/BlitterAmp/commit/ffb88bb74caad3a3d5c03c3b8e64e7c1fc88e682))
* add genre browsing and refine playback ([#55](https://github.com/BlitterAmp/BlitterAmp/issues/55)) ([16c793b](https://github.com/BlitterAmp/BlitterAmp/commit/16c793bd05e3b596adc037053534ca6c617d3f4b))
* add Linux-native window chrome ([#38](https://github.com/BlitterAmp/BlitterAmp/issues/38)) ([a33e0c7](https://github.com/BlitterAmp/BlitterAmp/commit/a33e0c7324c69ce70ba5f350f84e99296ae496aa))
* configure Discogs artwork enrichment ([#53](https://github.com/BlitterAmp/BlitterAmp/issues/53)) ([bede899](https://github.com/BlitterAmp/BlitterAmp/commit/bede899c846de7e0a742f8f973122a274faa7e9a))
* play sound from About logo ([#37](https://github.com/BlitterAmp/BlitterAmp/issues/37)) ([487b546](https://github.com/BlitterAmp/BlitterAmp/commit/487b5469a5d1b35909c8fde83264220e64c42b08))
* polish artwork and taste controls ([#41](https://github.com/BlitterAmp/BlitterAmp/issues/41)) ([1015ae1](https://github.com/BlitterAmp/BlitterAmp/commit/1015ae19cfe922da7578d13b1297e0e14209baf9))
* restore player session after restart ([#56](https://github.com/BlitterAmp/BlitterAmp/issues/56)) ([7839bf4](https://github.com/BlitterAmp/BlitterAmp/commit/7839bf4e2ab304927d5d61457586c975b3b48450))
* ship artwork bytes as binary IPC responses ([#49](https://github.com/BlitterAmp/BlitterAmp/issues/49)) ([c3e7b5b](https://github.com/BlitterAmp/BlitterAmp/commit/c3e7b5b4c60f10dbbbf6ced58f08d146fb62cd28))
* show current library activity ([#54](https://github.com/BlitterAmp/BlitterAmp/issues/54)) ([5afd2ea](https://github.com/BlitterAmp/BlitterAmp/commit/5afd2ea1a23699ddddbe95c51ebf2330d168fafe))
* support structured artist credits ([#42](https://github.com/BlitterAmp/BlitterAmp/issues/42)) ([8c0aae4](https://github.com/BlitterAmp/BlitterAmp/commit/8c0aae4a42e430d54e00b8bad6a8699caf04e8a0))
* virtualize album and artist grids ([#48](https://github.com/BlitterAmp/BlitterAmp/issues/48)) ([69b9527](https://github.com/BlitterAmp/BlitterAmp/commit/69b9527f3e4c9649acc47478c68f524f05303094))


### Bug Fixes

* center macOS titlebar controls ([#32](https://github.com/BlitterAmp/BlitterAmp/issues/32)) ([df7d925](https://github.com/BlitterAmp/BlitterAmp/commit/df7d9250d5f438be1fcc97cdebb9254c09ebf355))
* coalesce event syncs and keep hidden grids inert ([#52](https://github.com/BlitterAmp/BlitterAmp/issues/52)) ([51c5274](https://github.com/BlitterAmp/BlitterAmp/commit/51c5274a36dd2c602faa2612b186e0db6c50d2fb))
* configure WebKit for NVIDIA Wayland ([#36](https://github.com/BlitterAmp/BlitterAmp/issues/36)) ([a64204a](https://github.com/BlitterAmp/BlitterAmp/commit/a64204ac479758fea6fcf12c3d7b2e32f31105af))
* correct Tauri traffic-light geometry ([#34](https://github.com/BlitterAmp/BlitterAmp/issues/34)) ([34c1e6b](https://github.com/BlitterAmp/BlitterAmp/commit/34c1e6b328dacf2653ce9f23de0e1e3d5951fa6f))
* make mirror bootstrap transactional and reset-aware ([#44](https://github.com/BlitterAmp/BlitterAmp/issues/44)) ([71c8b50](https://github.com/BlitterAmp/BlitterAmp/commit/71c8b50d8d4266eb26adaf72a87c54e8cebfa725))
* preserve smooth NVIDIA Wayland rendering ([#39](https://github.com/BlitterAmp/BlitterAmp/issues/39)) ([cfcb3b8](https://github.com/BlitterAmp/BlitterAmp/commit/cfcb3b866c0c0c30830c358799b5c8f3d7b5858b))
* refresh managed engine callback URL ([#40](https://github.com/BlitterAmp/BlitterAmp/issues/40)) ([b2a6081](https://github.com/BlitterAmp/BlitterAmp/commit/b2a6081778724885e37adc739eeb2a94d6c48064))
* reset managed engine database on schema drift ([#46](https://github.com/BlitterAmp/BlitterAmp/issues/46)) ([2f347b5](https://github.com/BlitterAmp/BlitterAmp/commit/2f347b504dd752f7af871a7646c71a114d353f40))
* settle grid measurements to whole pixels ([#51](https://github.com/BlitterAmp/BlitterAmp/issues/51)) ([5d654d7](https://github.com/BlitterAmp/BlitterAmp/commit/5d654d796676e641ebf2dc3621f87ea855cea1e9))
* stop art fetch failure amplification and leaks ([#45](https://github.com/BlitterAmp/BlitterAmp/issues/45)) ([aa128d3](https://github.com/BlitterAmp/BlitterAmp/commit/aa128d3625b731337428329a33d910cdbfd24906))
* subscribe before syncing library ([#43](https://github.com/BlitterAmp/BlitterAmp/issues/43)) ([5358c9b](https://github.com/BlitterAmp/BlitterAmp/commit/5358c9b743c0d0c8631bce66d8ec6c02c47efc4c))
* survive stale virtual rows and view render crashes ([#50](https://github.com/BlitterAmp/BlitterAmp/issues/50)) ([44c640c](https://github.com/BlitterAmp/BlitterAmp/commit/44c640c5938f3fcabe906a360ce4e14354899e2b))


### Performance Improvements

* virtualize large play queues ([#31](https://github.com/BlitterAmp/BlitterAmp/issues/31)) ([4787e94](https://github.com/BlitterAmp/BlitterAmp/commit/4787e94a50df3c60fcfb7610f55d152cdf416cf3))

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

# v2.0.1 ROM extraction and shield verification

- 25 ROM blocks decoded with strict bounds and expected output-size checks. Seven stage 1 blocks match 40,960 bytes of live VRAM exactly.
- All 131,072 pixel indices decoded from 64 KiB VRAM match the compiled, unmodified SNESTilesKitten lowlevelstuff C decoder.
- Controlled SA-1 timer trace covers every update of the 512-frame B countdown, including the exact expiry. Respawn protection observations cover 96 frames. ROM version and intervention are documented in [ROM_ANALYSIS.md](ROM_ANALYSIS.md).
- **206 / 206 automated tests passed**, covering decoder variants/corruption, exact shield countdown, enemy bullets, Boss contact, pause, refresh, falling, respawn, pickup placement, icon separation and persistent protection visuals, alongside existing NES/Spirits tests. See [complete test log](rom-patch-test-results.txt).
- Browser normal-input pilot: **30 / 30 full stage completions** across three stages and ten seeds. See [results](rom-patch-browser-results.json).
- Browser performance across 600 rendered frames: **56.6 FPS**, render work p95 **0.5 ms**, frame interval p95 **18.2 ms**, maximum **138 DOM nodes**. All three stages completed. See [performance](rom-patch-performance.json).
- Browser visual inspection: protection indicator surrounds the visible player, extracted original/FC scenes render side by side; both tested pages have no browser errors. Gameplay reports zero Canvas elements, raster elements or raster requests.

These results establish correctness of the implemented changes and extraction checks. Passing the game's own tests does not establish fidelity of the still-custom weapons, stages or Boss patterns to the original ROM.

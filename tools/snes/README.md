# Contra III extraction tools

Build-time JavaScript / C tools, GPL-3.0-or-later. See LICENSE.txt. Game runtime does not load this directory.

1. `node tools/snes/extract.cjs ROM_PATH OUTPUT_DIRECTORY [VRAM_DUMP]` extracts the identified 25-block address profile. Unknown ROM hashes, malformed streams and unexpected decoded lengths fail. VRAM verification is optional but mismatches are fatal.
2. In SNESTilesKitten open an extracted `.bin` as the input file and its matching `.stk` preset. Use `None` compression. Presets are meaningful for graphics/sprite blocks; metatile definitions and layouts are data tables, not directly drawable 4bpp art. Supply a captured CGRAM palette separately; file bytes at palette offset zero are not an authoritative palette.
3. `node tools/snes/build-proof.cjs SNAPSHOT OUTPUT_ASSET_DIRECTORY` composes the initial scene from Snes9x snapshot version 0014. Requires the project's Sharp dependency. `ROM_PREVIEW_DIR` optionally saves PNGs for build-time QA. Runtime output is CSS.

`probe.c` is a small headless libretro host. Put a trusted Snes9x core DLL and the matching `libretro.h` beside it, compile with `gcc -O2 probe.c -o probe.exe`, and run from a private scratch directory:

```
probe.exe ROM_PATH
probe.exe ROM_PATH barrier-timer-experiment
```

The first uses ordinary controller input. A third argument enables the documented controlled write to BW-RAM before frame 1200. It writes `trace.csv`, PPM frames, snapshots and VRAM dumps in the current directory. Preserve/rename results before the second run. The ROM is read only. Keep these private dumps outside the Git checkout and public web server.

Validation used Snes9x 1.63 commit 890b5d4, snapshot version 0014. Core SHA-256 is in ../../ROM_ANALYSIS.md. Dependencies are obtained externally; no emulator/ROM is embedded in the game.

References: [SNESTilesKitten 7ed9e3f](https://github.com/Skarsnik/SNESTilesKitten/tree/7ed9e3fd1a1891bfb1dd32ac5b887722d0918562), [sneshacking 4be0df0](https://github.com/Skarsnik/sneshacking/tree/4be0df0dc6ad3b3ab0d5397a172c67bb0e5767d9), [Proton Konami SNES decompressor](https://github.com/ProtonNoir/SNES-decompression-tools/blob/8149ef6f2bcf121565db63251fe0d3dc429d8b50/Konami/konami_d.cpp), [Snes9x snapshot format](https://github.com/libretro/snes9x/blob/890b5d4/snapshot.cpp).

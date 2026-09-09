// SPDX-License-Identifier: GPL-3.0-or-later
// Build-time tool only. Based on SNESTilesKitten's Konami sliding-window decoder.
// Contra III differs: header counts itself, A0-BF copies distinct bytes with zero prefixes.
'use strict';
function unpack(rom, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 2 > rom.length) throw Error('Invalid offset');
  const header = rom.readUInt16LE(offset), end = offset + (header & 0x7fff);
  if (header & 0x8000) throw Error('Interleaved blocks are not verified by this Contra III profile');
  if (end > rom.length || end < offset + 2) throw Error('Invalid compressed size');
  let cursor = offset + 2, ring = 0x3df, length = 0;
  const output = Buffer.alloc(65536), window = Buffer.alloc(1024);
  function read() { if (cursor >= end) throw Error('Truncated command'); return rom[cursor++]; }
  function write(value) {
    if (length === output.length) throw Error('Output exceeds 64 KiB');
    output[length++] = value; window[ring] = value; ring = (ring + 1) & 1023;
  }
  while (cursor < end) {
    const command = read();
    if (command < 0x80) {
      const pair = command * 256 + read(); let source = pair & 1023;
      for (let n = (command >> 2) + 2; n > 0; n--) write(window[source++ & 1023]);
    } else if (command < 0xa0) {
      for (let n = command & 31; n > 0; n--) write(read());
    } else if (command < 0xc0) {
      for (let n = (command & 31) + 2; n > 0; n--) { write(0); write(read()); }
    } else {
      const value = command < 0xe0 ? read() : 0;
      // In this game FF means 33 zeros, not the later extended-zero variant.
      for (let n = (command & 31) + 2; n > 0; n--) write(value);
    }
  }
  return { bytes: output.subarray(0, length), compressed: end - offset };
}
function decodeTiles(data, bpp = 4) {
  if (![2,4,8].includes(bpp) || data.length % (bpp * 8)) throw Error('Incomplete planar tile');
  const pixels = Buffer.alloc(data.length / (bpp * 8) * 64);
  for (let tile=0;tile<pixels.length/64;tile++) for(let y=0;y<8;y++) for(let x=0;x<8;x++) {
    let value=0;
    for(let plane=0;plane<bpp;plane++) value|=((data[tile*bpp*8+(plane>>1)*16+y*2+(plane&1)]>>(7-x))&1)<<plane;
    pixels[tile*64+y*8+x]=value;
  }
  return pixels;
}
module.exports={unpack,decodeTiles};

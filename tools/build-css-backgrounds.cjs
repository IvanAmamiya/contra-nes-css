'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sharp = require('sharp'), { pixelShadows, pixelBackground, pixelGradients, visibleHash } = require('./build-css-assets.cjs');
const root = path.resolve(__dirname, '..'), hash = b => crypto.createHash('sha256').update(b).digest('hex');
async function build() {
  const tiles = [], tileIndex = new Map(), maps = {}, sources = {}, decoded={};
  const dir = path.join(root, 'assets/background-source');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort()) {
    const bytes = fs.readFileSync(path.join(dir, file));
    const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const id = path.parse(file).name, ids = [], cols = Math.ceil(info.width / 8), rows = Math.ceil(info.height / 8);
    decoded[id]={data,width:info.width};
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      const pixels = Buffer.alloc(8 * 8 * 4);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const sx = tx * 8 + x, sy = ty * 8 + y;
        if (sx < info.width && sy < info.height) data.copy(pixels, (y * 8 + x) * 4, (sy * info.width + sx) * 4, (sy * info.width + sx) * 4 + 4);
      }
      const key = hash(pixels); let tile = tileIndex.get(key);
      if (tile === undefined) { tile = tiles.length; tileIndex.set(key, tile); tiles.push({rgbaSha256:key,visibleRgbaSha256:visibleHash(pixels),css:pixelShadows(pixels,8,8),background:pixelBackground(pixels)}); }
      ids.push(tile);
    }
    maps[id] = {width:info.width,height:info.height,cols,rows,tiles:ids};
    const stage = id.match(/stage-(\d)/)[1];
    sources[id] = {file,sha256:hash(bytes),rgbaSha256:hash(data),url:id.endsWith('title') ? `https://nesmaps.com/maps/Contra/images/ContraStage${stage}Title.png` : `https://nesmaps.com/maps/Contra/ContraMapStage${stage}${id.endsWith('objects')?'':'BG'}.png`};
  }
  // Source rectangles remain in native pixels. No resize, repaint, or palette replacement.
  const patches = {
    logo:{x:288,y:48,w:192,h:72}, heroes:{x:384,y:120,w:96,h:72},
    mountain:{x:544,y:0,w:256,h:112}, forest:{x:2944,y:16,w:32,h:56}, trunk:{x:2944,y:80,w:32,h:64},
    grass:{x:544,y:104,w:32,h:24}, rock:{x:544,y:128,w:64,h:64},
    bridge:{x:1296,y:112,w:64,h:32}, water:{x:544,y:216,w:64,h:24},
    fortress:{x:3776,y:48,w:64,h:160}, core:{x:3736,y:160,w:24,h:24}, gun:{x:3728,y:120,w:24,h:24}
  };
  for (const patch of Object.values(patches)) patch.map='stage-1';
  patches.crate={map:'stage-1-objects',x:832,y:144,w:32,h:32};
  patches.turret={map:'stage-1-objects',x:1760,y:144,w:32,h:32};
  patches['red-turret']={map:'stage-1-objects',x:2560,y:144,w:32,h:32};
  const patchRules=[],fastPatchRules=[];
  for(const[name,p]of Object.entries(patches)){
    const source=decoded[p.map],pixels=Buffer.alloc(p.w*p.h*4);
    for(let y=0;y<p.h;y++)source.data.copy(pixels,y*p.w*4,((p.y+y)*source.width+p.x)*4,((p.y+y)*source.width+p.x+p.w)*4);
    p.visibleRgbaSha256=visibleHash(pixels);
    patchRules.push(`.patch-${name}{width:${p.w}px;height:${p.h}px}.patch-${name}::before{background:${pixelBackground(pixels)};box-shadow:${pixelShadows(pixels,p.w,p.h)}}`);
    if(Array.from(pixels).some((v,i)=>i%4===3&&v!==255))throw new Error('Opaque overlap requires opaque source patches');
    fastPatchRules.push(`.patch-${name}{width:${p.w}px;height:${p.h}px;background:${pixelGradients(pixels,p.w,p.h,true)}}`);
  }
  fs.writeFileSync(path.join(root,'assets/nes-patches.css'),'/* Native-pixel patches: fewer DOM elements, identical pixels. */\n'+patchRules.join('\n'));
  fs.writeFileSync(path.join(root,'assets/nes-patches-fast.css'),'/* Native pixels via hard-stop CSS row gradients. */\n'+fastPatchRules.join('\n'));
  const manifest = {version:1,tileSize:8,tileCount:tiles.length,credit:'Maps by Rick N. Bruns / NES Maps; original game graphics Konami',sources,maps,patches,tiles:tiles.map(({rgbaSha256,visibleRgbaSha256})=>({rgbaSha256,visibleRgbaSha256}))};
  fs.writeFileSync(path.join(root,'assets/nes-backgrounds.css'), '/* Lossless CSS tiles from NES Maps. Sources and crops: backgrounds.json. */\n'+tiles.map((t,i)=>`.bg-${i}::before{background:${t.background};box-shadow:${t.css}}`).join('\n'));
  fs.writeFileSync(path.join(root,'assets/backgrounds.json'),JSON.stringify(manifest));
  fs.writeFileSync(path.join(root,'assets/backgrounds.js'),`window.ContraBackgrounds=${JSON.stringify(manifest)};\n`);
  console.log(`Generated ${Object.keys(maps).length} source maps / ${tiles.length} unique 8x8 CSS tiles.`);
}
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build};

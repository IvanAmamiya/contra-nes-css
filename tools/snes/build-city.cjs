// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpack,decodeTiles}=require('./konami.cjs'),{snapshot,ppu}=require('./snapshot.cjs');
const {pixelGradients}=require('../build-css-assets.cjs'),{quantize,palettes}=require('../build-spirits-art.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const colors=palettes.map(p=>p.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16))));
function tileEntry(layout,definitions,tx,ty){
 const at=(Math.floor(tx/32)*64+(ty>>2)*8+(tx>>2&7))*2;
 if(at<0||at+2>layout.length||ty<0||ty>31)return 0x260;
 const pointer=layout.readUInt16LE(at),fx=!!(pointer&0x4000),fy=!!(pointer&0x8000);
 const offset=(pointer&0x3fff)+((fy?3-(ty&3):ty&3)*4+(fx?3-(tx&3):tx&3))*2;
 if(offset+2>definitions.length)throw Error('Missing metatile definition 0x'+offset.toString(16));
 return definitions.readUInt16LE(offset)^(pointer&0xc000);
}
// Direct translation of ROM $00:CC77-CCEF. Thresholds are stage-specific DP $C8-$DE.
function collisionCode(entry,thresholds){
 const t=entry&1023,mirror=(entry>>14)&1;
 const codes=[0,0x2002,4,0x4008,0x4010,0x6020,0x6040,0x6080,0x6100,0x1200,0x5400,0x5800];
 for(let i=0;i<thresholds.length;i++)if(t<thresholds[i])return codes[i]^([3,4,5,6,7,8,10,11].includes(i)?mirror:0);
 return 0xa000;
}
function rgbaTile(entry,indices,palette){const data=Buffer.alloc(256);for(let y=0;y<8;y++)for(let x=0;x<8;x++){
 const color=indices[(entry&1023)*64+(entry&0x8000?7-y:y)*8+(entry&0x4000?7-x:x)];
 if(color)data.set([...palette[(entry>>10&7)*16+color],255],(y*8+x)*4);
}return data;}
function source(romFile,snapshotFile){
 const rom=fs.readFileSync(romFile);if(hash(rom)!=='44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017')throw Error('Validate the profile for this ROM first');
 const b=snapshot(snapshotFile),p=ppu(b.PPU);
 const definitions=Buffer.concat([unpack(rom,0x53064).bytes,unpack(rom,0x54dbc).bytes]);
 if(!definitions.equals(b.SRA.subarray(0x5000,0x5000+definitions.length)))throw Error('Metatile definitions differ from running RAM');
 const layout=unpack(rom,0x55871).bytes,bg2=unpack(rom,0x55e6d).bytes,bg2defs=unpack(rom,0x5413b).bytes;
 const thresholds=Array.from({length:12},(_,i)=>b.SRA.readUInt16LE(0xc8+i*2));
 const events=[];for(let screen=0;screen<28;screen++){
  let at=rom.readUInt16LE(0x29488+screen*2)+0x20000;
  while(rom[at]!==255){if(at>=0x297e6)throw Error('Unterminated placement list');
   events.push({screen,trigger:screen*256+rom[at],type:rom[at+1],flags:rom.readUInt16LE(at+2),screenX:rom.readInt16LE(at+4),y:rom.readInt16LE(at+6),parameter:rom.readUInt16LE(at+8),romOffset:at});at+=10;
  }
 }
 return{rom,b,p,definitions,layout,bg2,bg2defs,thresholds,events};
}
async function build(romFile,snapshotFile,out){
 const s=source(romFile,snapshotFile),indices=decodeTiles(s.b.VRA),palette=s.p.palette.map(n=>[n&31,n>>5&31,n>>10&31].map(c=>Math.floor(c*255/31)));
 const manifest={source:{romSha256:hash(s.rom),definitions:[0x53064,0x54dbc],layout:0x55871,placement:0x29488,collisionRoutine:0xcc77},width:7168,height:224,palettes,thresholds:s.thresholds,events:s.events,assets:{}};
 const css=['/* ROM stage 1, native 1px geometry, four FC palettes, CSS only. */'],cache=new Map(),tiles=[],collision=[];
 function exportChunk(data){const ink=Buffer.from(data);for(let i=0;i<ink.length;i+=4)if(ink[i]<ink[i+2]*1.15+4){ink[i]=Math.round(ink[i]*.35);ink[i+1]=Math.round(ink[i+1]*.65);ink[i+2]=Math.min(255,Math.round(ink[i+2]*1.3));}const q=quantize(ink,32,32,colors.slice(0,2)),key=hash(q.data);if(cache.has(key))return cache.get(key);const id=cache.size;cache.set(key,id);css.push(`.rom-city-${id}{background:${pixelGradients(q.data,32,32)}}`);return id;}
 const full=Buffer.alloc(7168*224*4);
 for(let cy=0;cy<7;cy++)for(let cx=0;cx<224;cx++){
  const data=Buffer.alloc(4096);for(let y=0;y<4;y++)for(let x=0;x<4;x++){
   const tx=cx*4+x,ty=cy*4+y,e=tileEntry(s.layout,s.definitions,tx,ty),t=rgbaTile(e,indices,palette);
   collision[ty*896+tx]=collisionCode(e,s.thresholds);
   for(let py=0;py<8;py++)t.copy(data,((y*8+py)*32+x*8)*4,py*32,(py+1)*32);
  }
  tiles.push(exportChunk(data));for(let y=0;y<32;y++)data.copy(full,((cy*32+y)*7168+cx*32)*4,y*128,(y+1)*128);
 }
 manifest.art={cols:224,chunks:tiles,prefix:'rom-city-'};manifest.collision=collision;
 const sky=[];for(let cy=0;cy<7;cy++)for(let cx=0;cx<8;cx++){
  const data=Buffer.alloc(4096);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const e=tileEntry(s.bg2,s.bg2defs,cx*4+x,cy*4+y),t=rgbaTile(e,indices,palette);for(let py=0;py<8;py++)t.copy(data,((y*8+py)*32+x*8)*4,py*32,(py+1)*32);}
  sky.push(exportChunk(data));
 }manifest.sky=sky;manifest.chunkCount=cache.size;
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'spirits-city.css'),css.join('\n'));fs.writeFileSync(path.join(out,'spirits-city.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(out,'spirits-city.js'),`(function(r){const d=${JSON.stringify(manifest)};if(typeof module==='object'&&module.exports)module.exports=d;else r.SpiritsCity=d;})(typeof window!=='undefined'?window:this);\n`);
 if(process.env.ROM_PREVIEW_DIR)await require('sharp')(full,{raw:{width:7168,height:224,channels:4}}).png().toFile(path.join(process.env.ROM_PREVIEW_DIR,'city-layout-original.png'));
 console.log(JSON.stringify({screens:28,width:manifest.width,events:s.events.length,chunks:cache.size,definitions:s.definitions.length}));
 return manifest;
}
if(require.main===module)build(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={source,tileEntry,collisionCode,rgbaTile,build};

// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {snapshot,ppu}=require('./snapshot.cjs'),{decodeTiles}=require('./konami.cjs');
const {pixelGradients}=require('../build-css-assets.cjs'),{quantize,palettes}=require('../build-spirits-art.cjs');
function render(file){
 const blocks=snapshot(file),state=ppu(blocks.PPU),vram=blocks.VRA;
 if(state.mode!==1||state.obj.sizes!==0)throw Error('This proof compositor supports Contra III stage 1 mode 1 only');
 const indices4=decodeTiles(vram,4),indices2=decodeTiles(vram,2),pixels=Buffer.alloc(256*224*4);
 const palette=state.palette.map(n=>[n&31,(n>>5)&31,(n>>10)&31].map(c=>Math.floor(c*255/31)));
 function dot(x,y,index){if(x<0||x>=256||y<0||y>=224)return;pixels.set([...palette[index],255],(y*256+x)*4);}
 for(let y=0;y<224;y++)for(let x=0;x<256;x++)dot(x,y,0);
 function bg(layer){const b=state.bg[layer],bpp=layer===2?2:4,indices=bpp===2?indices2:indices4;
  if(b.size)throw Error('16px hardware tiles are outside this proof profile');
  for(let y=0;y<224;y++)for(let x=0;x<256;x++){
   const sx=(x+b.x)&511,sy=(y+b.y+1)&511,tx=sx>>3,ty=sy>>3;
   const page=(b.mapSize&1?tx>>5:0)+(b.mapSize&2?(ty>>5)*(b.mapSize&1?2:1):0);
   const at=(b.map+page*2048+((ty&31)*32+(tx&31))*2)&65535,entry=vram.readUInt16LE(at);
   const xx=entry&0x4000?7-(sx&7):sx&7,yy=entry&0x8000?7-(sy&7):sy&7;
   const tile=((b.tiles/(bpp*8))+(entry&1023))%(vram.length/(bpp*8)),color=indices[tile*64+yy*8+xx];
   if(color)dot(x,y,((entry>>10)&7)*(1<<bpp)+color);
  }
 }
 bg(1);bg(0);
 for(const obj of state.sprites.slice().reverse()){
  const x=obj.x>32767?obj.x-65536:obj.x,size=obj.large?16:8;
  if(x+size<0||x>=256||obj.y>=224)continue;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
   const ox=obj.flipX?size-1-px:px,oy=obj.flipY?size-1-py:py;
   const name=(obj.tile&0x100)|((obj.tile+(ox>>3)+(oy>>3)*16)&255);
   const at=(state.obj.base+(name&255)*32+(name&256?8192+state.obj.select:0))&65535;
   const color=indices4[(at>>5)*64+(oy&7)*8+(ox&7)];if(color)dot(x+px,obj.y+py,128+obj.palette*16+color);
  }
 }
 bg(2);return{pixels,state};
}
async function build(file,out){
 const {pixels,state}=render(file),ink=Buffer.from(pixels),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(let i=0;i<ink.length;i+=4)if(ink[i]<ink[i+2]*1.15+4){ink[i]=Math.round(ink[i]*.35);ink[i+1]=Math.round(ink[i+1]*.65);ink[i+2]=Math.min(255,Math.round(ink[i+2]*1.3));}
 const fc=quantize(ink,256,224,palettes.slice(0,2).map(p=>p.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)))));
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'rom-proof.css'),`.rom-original{background:${pixelGradients(pixels,256,224,true)}}\n.rom-fc{background:${pixelGradients(fc.data,256,224,true)}}\n`);
 const icon=Buffer.alloc(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=((y+8)*256+x+88)*4;if(pixels[p]+pixels[p+1]+pixels[p+2]>110)pixels.copy(icon,(y*16+x)*4,p,p+4);}
 const bomb=quantize(icon,16,16,[[[0,0,0],[120,120,120],[184,184,184],[248,248,248]]]).data;
 fs.writeFileSync(path.join(out,'rom-items.css'),`/* Helio bomb HUD icon from local Contra III ROM frame 780, FC grayscale. */\n.art-spirits_bomb{width:16px;height:16px;background:${pixelGradients(bomb,16,16)}}\n`);
 fs.writeFileSync(path.join(out,'rom-proof.json'),JSON.stringify({source:'Snes9x snapshot 0014; local SA-1 ROM; frame 780',width:256,height:224,original:hash(pixels),fc:hash(fc.data),palettes,attributes:fc.attributes,backgrounds:state.bg,obj:state.obj,limits:'Proof compositor for first scene: Mode 1, 8px BG tiles, 8/16px OBJ; no HDMA/color-math/priority emulation.'},null,2));
 if(process.env.ROM_PREVIEW_DIR){const sharp=require('sharp');for(const[name,data]of [['rom-original',pixels],['rom-fc',fc.data]])await sharp(data,{raw:{width:256,height:224,channels:4}}).resize(768,672,{kernel:'nearest'}).png().toFile(path.join(process.env.ROM_PREVIEW_DIR,name+'.png'));}
 console.log('ROM scene assembled from VRAM/CGRAM/OAM; exported as CSS in original and FC palettes');
}
if(require.main===module)build(process.argv[2],process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={render,build};

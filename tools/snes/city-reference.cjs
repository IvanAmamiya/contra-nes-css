// Build reference fixtures from emulator dumps; independent of the JavaScript game.
'use strict';
const fs=require('fs'),path=require('path');
const {snapshot,ppu}=require('./snapshot.cjs'),{source,tileEntry,collisionCode}=require('./build-city.cjs');
function build(work,romFile,out){
 const s=source(romFile,path.join(work,'snes9x-runtime/state-780.bin'));
 const movementRam=fs.readFileSync(path.join(work,'city-measure/ram-frames.bin')),movement=[];
 for(let frame=0;frame<130;frame++){
  const i=frame*8192,u16=at=>movementRam.readUInt16LE(i+at);
  movement.push({frame,right:frame>=30,jump:frame===60,x:u16(0x20a)+u16(0x208)/65536+u16(0x1380),feet:u16(0x20e)+u16(0x20c)/65536});
 }
 const guns={};for(const [code,number]of Object.entries({M:0,S:1,C:2,H:3,L:5})){
  const b=fs.readFileSync(path.join(work,`gun-${number}/ram-frames.bin`)),first=[],births=[],previous=Array(10).fill(0);
  for(let f=0;f<160;f++)for(let slot=0;slot<10;slot++){
   const at=f*8192+0xac0+slot*32,flag=b.readUInt16LE(at+16);
   if(flag&&!previous[slot]){const item={frame:f,slot,flag,vx:b.readInt32LE(at+24)/65536,vy:b.readInt32LE(at+28)/65536};births.push(item);if(f===0)first.push(item);}
   previous[slot]=flag;
  }guns[code]={first,births:births.filter(b=>b.frame<40)};
 }
 const checks=[],terrainSamples=[];for(const frame of [0,240,480,600,840,960]){
  const b=snapshot(path.join(work,`city-walk/state-${frame}.bin`)),p=ppu(b.PPU),start=Math.ceil(p.bg[0].x/8);let artMatches=0,collisionMatches=0,total=0,differences=[];
  for(let ty=0;ty<28;ty++)for(let tx=start;tx<start+30;tx++){
   const index=(tx>>5&1)*1024+ty*32+(tx&31),expected=tileEntry(s.layout,s.definitions,tx,ty),actual=b.VRA.readUInt16LE(p.bg[0].map+index*2),collision=b.SRA.readUInt16LE(0x4000+index*2);
   if(actual===expected)artMatches++;else differences.push({tx,ty,actual,baseMap:expected});
   terrainSamples.push([tx,ty,collision,actual,expected]);
   if(collision===collisionCode(actual,s.thresholds))collisionMatches++;total++;
  }checks.push({frame,camera:p.bg[0].x,total,artMatches,collisionMatches,differences});
 }
 const result={baseline:s.rom.toString('ascii',0x7fc0,0x7fd5),romSha256:'44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017',method:{movement:'Natural inputs after loading frame 780; no RAM writes. x is 16.16 screen position + camera; feet uses the physical anchor, not the animation offset.',guns:'Isolated stationary firing experiment; only selected weapon ID is set in BW-RAM $1F84. Read projectiles from $AC0, stride $20. Modified SA-1 ROM, not a clean US reference.',maps:'Base ROM map compared with running VRAM. Runtime destruction changes some cells; mismatches are preserved, not discarded. Collision is checked against the actual runtime tile entry.'},movement,guns,checks};
 result.terrainSamples=terrainSamples;fs.writeFileSync(out,JSON.stringify(result)+'\n');console.log(checks.map(({differences,...c})=>({...c,differences:differences.length})));
}
if(require.main===module)build(...process.argv.slice(2));module.exports={build};

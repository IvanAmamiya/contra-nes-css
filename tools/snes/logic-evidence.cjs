// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(work,out){
 const runs=[];
 for(const [name,type,sourceState,addresses]of [
  ['trace-stairs-landing',254,'city-walk/state-480.bin',['0185D0','0193DB','0193DF','0193E2','0193E5']],
  ['trace-wall',4,'city-later/state-1080.bin',['01C5EA','01C5ED','01C5F0','01C5F3','01C609','01C611','01C634','01C637']],
  ['trace-tank',9,'city-later/state-1440.bin',['01B9E9','01BA1C','01BA22','01BA25','01BA28','01BA2B','01BA2E']]
 ]){
  const dir=path.join(work,name),d=JSON.parse(fs.readFileSync(path.join(dir,'executed.json'))),ram=fs.readFileSync(path.join(dir,'ram-frames.bin')),input=fs.readFileSync(path.join(work,name+'-input.csv')),transitions=[];
  let last='';for(let frame=0;frame<ram.length/8192;frame++){
   const s=ram.subarray(frame*8192,(frame+1)*8192),objects=[];
   for(let at=0x280;at<0xac0;at+=64)if(s.readUInt16LE(at+16)===type)objects.push({slot:at,state:s.readUInt16LE(at+18),hp:s.readInt16LE(at+6),x:s.readInt16LE(at+10)});
   const stateKey=JSON.stringify(objects.map(({slot,state,hp})=>[slot,state,hp]));
   if(type!==254&&stateKey!==last){transitions.push({frame,camera:s.readUInt16LE(0x1380),playerState:s.readUInt16LE(0x212),objects});last=stateKey;}
  }
  runs.push({name,actor:type,frames:ram.length/8192,traceRows:d.rows,instructionVariants:d.instructions.length,possiblyTruncated:d.possiblyTruncated,traceSha256:d.traceSha256,ramSha256:hash(ram),sourceStateSha256:hash(fs.readFileSync(path.join(work,sourceState))),inputCsv:input.toString().trim(),inputSha256:hash(input),transitions,instructions:d.instructions.filter(i=>addresses.includes(i.pc))});
 }
 const evidence={scope:'Partial reverse engineering of Contra III on a modified SA-1 ROM; not a full SFC game decompilation.',romSha256:'44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017',coreCommit:'890b5d445538fe790aa3add3d5702c80f551e0ae',instrumentedCoreSha256:hash(fs.readFileSync(path.join(work,'cpu-trace-runtime/snes9x_libretro.dll'))),validation:{stairsComparedFrames:111,stairsCoordinateMismatches:0,landingFrames:[{frame:94,feet:144},{frame:128,feet:72}],note:'Coordinates compared by tests/city-logic.test.cjs. Collision/player update only; NPC behavior and sprite hitboxes are not covered by this equality claim.'},limitations:['SA-1 CPU only; main CPU/SPC/DMA execution not traced.','Actor filter uses X and D; temporary X values are omitted, so this is not a complete instruction stream.','Natural controller input in these runs; loaded exploration snapshots can contain previously granted protection.','Tank/fire/Boss implementation is not established merely by locating routines.'],runs};
 const control=fs.readFileSync(path.join(work,'trace-stairs-control/ram-frames.bin')),traced=fs.readFileSync(path.join(work,'trace-stairs-landing/ram-frames.bin'));
 if(!control.equals(traced))throw Error('Instrumented/uninstrumented control run differs');
 evidence.tracerControl={frames:160,comparedBytes:control.length,mismatchingBytes:0,ramSha256:hash(control),uninstrumentedCoreSha256:hash(fs.readFileSync(path.join(work,'cpu-control-runtime/snes9x_libretro.dll')))};
 fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');return evidence;
}
if(require.main===module){if(process.argv.length!==4)throw Error('Usage: node logic-evidence.cjs PRIVATE_WORK OUTPUT_JSON');build(...process.argv.slice(2));}module.exports={build};

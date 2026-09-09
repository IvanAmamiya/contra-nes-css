// SPDX-License-Identifier: GPL-3.0-or-later
// Read emulator output independently of game code. Fixed protocol in ROM_LOGIC.md.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function build(work,out){
 const ram=fs.readFileSync(path.join(work,'trace-stairs-landing/ram-frames.bin')),csv=fs.readFileSync(path.join(work,'trace-stairs-landing/cpu.csv'));
 if(ram.length!==160*8192)throw Error('Expected 160 post-frame RAM samples');
 const rows=[];for(let f=48;f<160;f++){const s=ram.subarray(f*8192,(f+1)*8192);rows.push({frame:f,x:s.readUInt16LE(0x1380)+s.readInt32LE(0x208)/65536,feet:s.readInt32LE(0x20c)/65536,state:s.readUInt16LE(0x212),right:f>=100,jump:f===60||f===105});}
 const pcs=['00E16E','01857A','0185D0','0193DB'],samples={};
 for(const line of csv.toString().trim().split('\n').slice(1)){const r=line.trim().split(',');if(pcs.includes(r[1])&&!(samples[r[1]]?.length>=4))(samples[r[1]]??=[]).push({frame:+r[0],pc:r[1],opcode:r[2],p:r[3],a:r[4],x:r[5],y:r[6],d:r[7],db:r[8],feet:+r[12]});}
 const data={romSha256:'44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017',coreCommit:'890b5d445538fe790aa3add3d5702c80f551e0ae',traceSha256:crypto.createHash('sha256').update(csv).digest('hex'),method:'Read-only SA-1 instruction hook. Natural inputs after loading an existing state; no RAM writes in this run. Frame 48 is the grounded initial condition.',samples,stairs:rows};
 fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');return data;
}
if(require.main===module){if(process.argv.length!==4)throw Error('Usage: node logic-reference.cjs PRIVATE_WORK OUTPUT_JSON');build(...process.argv.slice(2));}module.exports={build};

// SPDX-License-Identifier: GPL-3.0-or-later
// Decode only executed instructions, using the recorded M/X flags for operand size.
'use strict';
const fs=require('fs'),crypto=require('crypto'),{names,modes}=require('./opcodes.cjs');
const ROM_SHA='44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017';
const sizes={Sig8:2,Imm8:2,Imm16:3,ImmX:3,ImmM:3,Abs:3,AbsIdxXInd:3,AbsIdxX:3,AbsIdxY:3,AbsInd:3,AbsIndLng:3,AbsLngIdxX:4,AbsLng:4,AbsJmp:3,AbsLngJmp:4,Acc:1,BlkMov:3,DirIdxIndX:2,DirIdxX:2,DirIdxY:2,DirIndIdxY:2,DirIndLngIdxY:2,DirIndLng:2,DirInd:2,Dir:2,Imp:1,RelLng:3,Rel:2,Stk:1,StkRel:2,StkRelIndIdxY:2};
const hex=(v,n)=>v.toString(16).toUpperCase().padStart(n,'0');
function romOffset(pc){
 const bank=pc>>>16,address=pc&65535;
 // This profile covers the unbanked LoROM windows of the measured SA-1 image.
 // Do not guess SA-1 programmable C0-FF mappings or disassemble BW-RAM as ROM.
 if((bank&0x7f)>=0x40||address<0x8000)throw Error('Unmapped PC $'+hex(pc,6));
 return (bank&0x7f)*0x8000+(address&0x7fff);
}
function decode(rom,pc,p){
 const at=romOffset(pc),opcode=rom[at],mode=modes[opcode];let size=sizes[mode];
 if(mode==='ImmM'&&(p&32)||mode==='ImmX'&&(p&16))size=2;
 if(!size||at+size>rom.length||(pc&65535)+size>65536)throw Error('Truncated or bank-crossing instruction');
 const bytes=rom.subarray(at,at+size),value=size>1?bytes.readUIntLE(1,size-1):0,dollar='$'+hex(value,(size-1)*2);
 let operand=dollar;
 if(['Imp','Stk'].includes(mode))operand='';
 else if(mode==='Acc')operand='A';
 else if(mode.startsWith('Imm'))operand='#'+dollar;
 else if(mode==='Rel'||mode==='RelLng')operand='$'+hex((pc&0xff0000)|((pc+size+(size===2?bytes.readInt8(1):bytes.readInt16LE(1)))&65535),6);
 else if(['AbsIdxX','AbsLngIdxX','DirIdxX'].includes(mode))operand+=',X';
 else if(['AbsIdxY','DirIdxY'].includes(mode))operand+=',Y';
 else if(['AbsIdxXInd','DirIdxIndX'].includes(mode))operand='('+dollar+',X)';
 else if(['AbsInd','DirInd'].includes(mode))operand='('+dollar+')';
 else if(['AbsIndLng','DirIndLng'].includes(mode))operand='['+dollar+']';
 else if(mode==='DirIndIdxY')operand='('+dollar+'),Y';
 else if(mode==='DirIndLngIdxY')operand='['+dollar+'],Y';
 else if(mode==='StkRel')operand+=',S';
 else if(mode==='StkRelIndIdxY')operand='('+dollar+',S),Y';
 else if(mode==='BlkMov')operand='$'+hex(bytes[2],2)+',$'+hex(bytes[1],2);
 return {pc:hex(pc,6),offset:hex(at,6),bytes:bytes.toString('hex').toUpperCase(),size,mnemonic:names[opcode],operand,mode};
}
function build(romFile,csvFile,out){
 const rom=fs.readFileSync(romFile),csv=fs.readFileSync(csvFile,'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 if(sha(rom)!==ROM_SHA)throw Error('Unknown ROM profile; verify mapping before decoding');
 const lines=csv.trim().split(/\r?\n/),header=lines.shift();
 if(header!=='frame,pc,opcode,p,a,x,y,d,db,actor,state,camera,feet')throw Error('Unexpected trace schema');
 const byPc=new Map();let previous=-1;
 for(const line of lines){
  const r=line.split(',');if(r.length!==13||!/^\d+$/.test(r[0])||!r.slice(1,9).every(s=>/^[0-9A-F]+$/i.test(s)))throw Error('Malformed trace row');
  const frame=+r[0],pc=parseInt(r[1],16),p=parseInt(r[3],16);if(frame<previous)throw Error('Unordered trace');previous=frame;
  const d=decode(rom,pc,p);if(!d.bytes.startsWith(r[2].toUpperCase()))throw Error('ROM/trace opcode mismatch at $'+r[1]);
  const key=d.pc+':'+d.size;let entry=byPc.get(key);
  if(!entry){entry={...d,count:0,firstFrame:frame,lastFrame:frame,sample:{p:r[3],a:r[4],x:r[5],y:r[6],d:r[7],db:r[8],actor:+r[9],state:+r[10]}};byPc.set(key,entry);}
  entry.count++;entry.lastFrame=frame;
 }
 const result={romSha256:ROM_SHA,traceSha256:sha(csv),rows:lines.length,possiblyTruncated:lines.length>=500000,note:'Executed addresses only. Actor filtering omits temporary X values and is not a complete call graph. Operand bytes are read from the verified ROM profile.',instructions:[...byPc.values()].sort((a,b)=>a.pc.localeCompare(b.pc)||a.size-b.size)};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(`${result.rows} trace rows; ${result.instructions.length} executed instruction variants; truncated=${result.possiblyTruncated}`);return result;
}
if(require.main===module){if(process.argv.length!==5)throw Error('Usage: node trace-disassemble.cjs ROM CSV OUTPUT_JSON');build(...process.argv.slice(2));}
module.exports={decode,romOffset,build};

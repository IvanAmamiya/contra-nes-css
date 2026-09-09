// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unpack,decodeTiles}=require('./konami.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const profile=[
 ['city-graphics-0',0x48000,8192,0],['city-graphics-1',0x4998e,8192,8192],
 ['city-graphics-2',0x4b32d,8192,16384],['city-graphics-3',0x4cd49,8192,24576],
 ['city-bg1-metatiles',0x53064,8192],['city-bg2-metatiles',0x5413b,6816],
 ['city-bg1-layout',0x55871,4096],['city-bg2-layout',0x55e6d,2048],
 ['shared-sprites-0',0x6bceb,2048,57344],['shared-sprites-1',0x6c2fe,2048,59392],['city-sprites',0x6c90c,4096,61440],
 ['factory-graphics-0',0x60000,8192],['factory-graphics-1',0x618a2,8192],
 ['factory-graphics-2',0x62fbf,8192],['factory-graphics-3',0x6465e,8192],
 ['factory-bg2-metatiles',0x68000,8192],['factory-bg1-metatiles',0x68cc4,8192],
 ['factory-bg2-layout',0x6a5e5,2048],['factory-bg1-layout',0x775a2,4096],
 ['hive-graphics-0',0x80000,8192],['hive-graphics-1',0x81c17,8193],
 ['hive-graphics-2',0x83927,8192],['hive-graphics-3',0x855a2,8192],
 ['hive-bg1-layout',0x871fe,4096],['hive-bg2-layout',0x87731,2048]
];
function extract(romFile,outDir,vramFile){
 const original=fs.readFileSync(romFile),copierHeader=original.length%32768===512?512:0,rom=original.subarray(copierHeader);
 const id=sha(rom),known=['44ebb9a450b5b77341fc9130ab45767a13212c242350aad450a4526f8a8d8017','a93ea87fc835c530b5135c5294433d15eef6dbf656144b387e89ac19cf864996','5d2a0ed336e2681d694395a2183d82bedcac93b612cbfb5f543da80a001e861d'];
 if(!known.includes(id))throw Error('Unknown ROM hash; validate address profile before extraction: '+id);
 const vram=vramFile?fs.readFileSync(vramFile):null;if(vram&&vram.length!==65536)throw Error('Expected 64 KiB VRAM dump');
 const report={rom:{sha256:id,bytes:rom.length,copierHeader,title:rom.toString('ascii',0x7fc0,0x7fd5).trim(),mapMode:rom[0x7fd5],modified:id===known[0]},blocks:[],verifiedBytes:0};
 fs.mkdirSync(outDir,{recursive:true});
 for(const[name,offset,expected,vramOffset]of profile){
  const d=unpack(rom,offset);if(d.bytes.length!==expected)throw Error(`${name}: ${d.bytes.length} bytes, expected ${expected}`);
  let match=null;if(vram&&vramOffset!==undefined){match=d.bytes.equals(vram.subarray(vramOffset,vramOffset+d.bytes.length));if(!match)throw Error(name+': ROM output differs from running VRAM');report.verifiedBytes+=d.bytes.length;}
  const info={name,offset:'0x'+offset.toString(16),compressed:d.compressed,decoded:d.bytes.length,sha256:sha(d.bytes),vramOffset,vramMatch:match};report.blocks.push(info);
  fs.writeFileSync(path.join(outDir,name+'.bin'),d.bytes);
  if(/graphics|sprites/.test(name)&&d.bytes.length%32===0){
  fs.writeFileSync(path.join(outDir,name+'.indices'),decodeTiles(d.bytes));
  fs.writeFileSync(path.join(outDir,name+'.stk'),`[_]\nname=Contra III ${name} (DECOMPRESSED FILE)\n[rom]\ntype=LoROM\n[tiles]\npc_location=0\nsnes_location=0\nlength=${d.bytes.length}\nbpp=4\ncompression=None\npattern=normal\n[palette]\npc_location=0\nnozerocolor=false\n`);
  }
 }
 fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module){const[rom,out,vram]=process.argv.slice(2);if(!rom||!out)throw Error('Usage: node extract.cjs ROM OUTPUT_DIR [VRAM_DUMP]');const result=extract(rom,path.resolve(out),vram);console.log(`${result.blocks.length} blocks; ${result.verifiedBytes} bytes verified against VRAM`);}
module.exports={extract,profile};

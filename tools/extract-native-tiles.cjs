'use strict';
// Read original CHR-RAM keys only. Replacement images and pack code are never imported.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const input=process.argv[2],palFile=process.argv[3];
if(!input||!palFile)throw new Error('Usage: node tools/extract-native-tiles.cjs hires.txt FCEUX.pal');
const bytes=fs.readFileSync(input),lines=bytes.toString('utf8').split(/\r?\n/),palette=fs.readFileSync(palFile),patterns=[],pairs=[],patternIds=new Map(),pairIds=new Set();
if(palette.length!==192)throw new Error('Expected 64 RGB palette entries');
let records=0;
for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(line.startsWith('#'))continue;
  const match=line.match(/^(?:\[[^\]]+\])?<tile>[^,]*,([0-9a-f]{32}),([0-9a-f]{8}),/i);if(!match)continue;
  records++;const hex=match[1].toUpperCase(),pal=match[2].toUpperCase();
  if(!patternIds.has(hex)){patternIds.set(hex,patterns.length);patterns.push(hex);}
  const key=hex+pal;if(pairIds.has(key))continue;pairIds.add(key);pairs.push({pattern:patternIds.get(hex),palette:pal,line:i+1});
}
const data={source:'https://github.com/TasticHacks/Contra80s/releases/tag/1.2',member:'Contra80s-v1.2/Contra (U) [!]/hires.txt',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),supportedRomSha1:lines.find(l=>l.startsWith('<supportedRom>'))?.slice(14).trim(),records,patternCount:patterns.length,pairCount:pairs.length,coverage:'All active original tile matching keys in this reference; not proven exhaustive against the complete ROM.',paletteSource:'https://github.com/TASEmulators/fceux/blob/master/output/palettes/FCEUX.pal',rgb:Array.from({length:64},(_,i)=>'#'+palette.subarray(i*3,i*3+3).toString('hex')),patterns,pairs};
const out=path.resolve(__dirname,'../assets');fs.writeFileSync(path.join(out,'native-tiles.json'),JSON.stringify(data));fs.writeFileSync(path.join(out,'native-tiles.js'),`window.ContraNativeTiles=${JSON.stringify(data)};\n`);fs.copyFileSync(palFile,path.join(out,'FCEUX.pal'));console.log({records,patterns:patterns.length,pairs:pairs.length});

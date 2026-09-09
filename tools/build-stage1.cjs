'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Optional source refresh: node tools/build-stage1.cjs path/to/nes-contra-us/src
function readSource(dir){
  const b2=fs.readFileSync(path.join(dir,'bank2.asm'),'utf8'),b3=fs.readFileSync(path.join(dir,'bank3.asm'),'utf8');
  function bytes(text,label){const section=text.split(label+':')[1];if(!section)throw Error(label);return section.split(/^\w[\w]*:/m)[0].split('\n').flatMap(line=>{const code=line.split(';')[0];return code.includes('.byte')?[...code.matchAll(/\$([\da-f]{2})/gi)].map(m=>parseInt(m[1],16)):[];});}
  return {url:'https://github.com/vermiceli/nes-contra-us',commit:'687d651c021fd7020f10d05b970ccb62663c94bd',bank2Sha256:hash(b2),bank3Sha256:hash(b3),screens:Array.from({length:13},(_,i)=>bytes(b2,'level_1_supertiles_screen_'+i.toString(16).padStart(2,'0'))),enemies:Array.from({length:13},(_,i)=>bytes(b2,'level_1_enemy_screen_'+i.toString(16).padStart(2,'0'))),supertiles:[...bytes(b3,'level_1_supertile_data'),...bytes(b3,'level_1_nametable_update_supertile_data')]};
}
function decompress(bytes){const out=[];for(let i=0;i<bytes.length;i++){const b=bytes[i];if(b<128)out.push(b);else if(b<240){if(i+1===bytes.length)throw Error('Truncated RLE');out.push(...Array(b&127).fill(bytes[++i]));}else throw Error('Unexpected row-copy RLE');}if(out.length!==56)throw Error('Horizontal screen must contain 56 supertiles');return out;}
function decode(source){
  const screens=source.screens.map(decompress),cols=208,rows=14,collision=Array(cols*rows).fill(0),platforms=[],water=[],solids=[],bridges=[];
  const collisionCode=t=>t===0?0:t<6?1:t<249?0:t<255?2:3;
  for(let screen=0;screen<13;screen++)for(let i=0;i<56;i++){
    const id=screens[screen][i],sx=screen*256+(i%8)*32,sy=Math.floor(i/8)*32;
    if(id*16+15>=source.supertiles.length)throw Error('Unknown supertile '+id);
    if([3,0x29,0x37].includes(id))bridges.push({x:sx,y:sy,w:32,h:32});
    for(let y=0;y<2;y++)for(let x=0;x<2;x++)collision[(sy/16+y)*cols+sx/16+x]=collisionCode(source.supertiles[id*16+y*8+x*2]);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;){
    const code=collision[y*cols+x],start=x;let bridge=bridges.find(b=>b.x<=x*16&&b.x+32>x*16&&b.y===y*16);
    if(!code){x++;continue;}
    while(++x<cols&&collision[y*cols+x]===code&&(!bridge||x*16<bridge.x+32)&&!!bridges.find(b=>b.x<=x*16&&b.x+32>x*16&&b.y===y*16)===!!bridge){}
    const rect={x:start*16,y:y*16,w:(x-start)*16,h:16};
    if(code===1)platforms.push({...rect,bridge:!!bridge});
    if(code===2)water.push(rect);
    if(code===3)solids.push(rect);
  }
  const objects=[];
  source.enemies.forEach((bytes,screen)=>{let i=0;while(bytes[i]!==255){if(i>=bytes.length)throw Error('Enemy terminator missing');const rawX=bytes[i++],typeRepeat=bytes[i++],type=typeRepeat&63;for(let r=0;r<=(typeRepeat>>6);r++){const ya=bytes[i++];if(ya===undefined)throw Error('Truncated enemy');objects.push({screen,rawX,type,attributes:ya&15,spawnCamera:screen*256+(rawX&254),cx:screen*256+(rawX&254)+240,cy:(ya&240)-16});}}});
  return {width:3328,height:224,sourceCrop:{x:512,y:16,w:3328,h:224},screens,collision:{cols,rows,size:16,cells:collision},platforms,water,solids,bridges,objects};
}
async function build(dir){
  const sourceFile=path.join(root,'assets/stage1-source.json');if(dir)fs.writeFileSync(sourceFile,JSON.stringify(readSource(dir)));
  const source=JSON.parse(fs.readFileSync(sourceFile)),data=decode(source),sharp=require('sharp'),{pixelGradients,visibleHash}=require('./build-css-assets.cjs');
  const {data:pixels,info}=await sharp(path.join(root,'assets/background-source/stage-1.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const chunks=[],unique=[],index=new Map();
  for(let y=0;y<224;y+=32)for(let x=0;x<3328;x+=32){
    const tile=Buffer.alloc(32*32*4);for(let row=0;row<32;row++)pixels.copy(tile,row*128,((y+16+row)*info.width+x+512)*4,((y+16+row)*info.width+x+544)*4);
    const key=visibleHash(tile);let id=index.get(key);if(id===undefined){id=unique.length;index.set(key,id);unique.push({hash:key,css:pixelGradients(tile,32,32,true)});}chunks.push(id);
  }
  data.art={cols:104,rows:7,size:32,chunks,hashes:unique.map(t=>t.hash)};data.source={url:source.url,commit:source.commit,sourceSha256:hash(fs.readFileSync(sourceFile)),mapSha256:hash(fs.readFileSync(path.join(root,'assets/background-source/stage-1.png')))};
  fs.writeFileSync(path.join(root,'assets/stage1.css'),'/* Native Stage 1, source crop (512,16) 3328x224. CSS only. */\n.stage-chunk{position:absolute;width:32px;height:32px}\n'+unique.map((t,i)=>`.stage-chunk-${i}{background:${t.css}}`).join('\n'));
  fs.writeFileSync(path.join(root,'assets/stage1.json'),JSON.stringify(data));
  fs.writeFileSync(path.join(root,'assets/stage1.js'),`(function(r){const data=${JSON.stringify(data)};if(typeof module==='object'&&module.exports)module.exports=data;else r.ContraStage1=data;})(typeof window!=='undefined'?window:this);\n`);
  console.log(JSON.stringify({screens:data.screens.length,objects:data.objects.length,platforms:data.platforms.length,chunks:chunks.length,uniqueChunks:unique.length}));
}
if(require.main===module)build(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={readSource,decompress,decode,build};

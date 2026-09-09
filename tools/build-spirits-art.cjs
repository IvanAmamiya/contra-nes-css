'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const {pixelGradients}=require('./build-css-assets.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets');
// Shared black + three inks in each 16x16 attribute region. Colours from an NES-style palette.
const palettes=[['000000','001848','0078a8','58d8f8'],['000000','302020','a85000','f8b800'],['000000','181858','6844a0','b8b8f8'],['000000','383838','787878','b8b8b8']];
const rgb=hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
const colors=palettes.map(p=>p.map(rgb));
const dist=(a,b)=>(a[0]-b[0])**2*.3+(a[1]-b[1])**2*.59+(a[2]-b[2])**2*.11;
function quantize(data,w,h,choices=colors,block=16){
 const result=Buffer.alloc(data.length),attributes=[];
 for(let y=0;y<h;y+=block)for(let x=0;x<w;x+=block){let best=0,error=Infinity;
  choices.forEach((p,k)=>{let e=0;for(let yy=y;yy<Math.min(h,y+block);yy++)for(let xx=x;xx<Math.min(w,x+block);xx++){const i=(yy*w+xx)*4;if(data[i+3])e+=Math.min(...p.map(c=>dist(data.subarray(i,i+3),c)));}if(e<error){error=e;best=k;}});
  attributes.push(best);const p=choices[best];
  for(let yy=y;yy<Math.min(h,y+block);yy++)for(let xx=x;xx<Math.min(w,x+block);xx++){const i=(yy*w+xx)*4;if(!data[i+3])continue;const c=p.reduce((a,b)=>dist(data.subarray(i,i+3),a)<dist(data.subarray(i,i+3),b)?a:b);result.set([...c,255],i);}
 }return{data:result,attributes};
}
async function build(){
 const css=['/* Contra III scenes adapted to four FC attribute palettes; CSS pixels only. */'],manifest={palettes,attributeSize:16,pixelStep:2,stages:{},assets:{},credit:'Konami; maps and sprite extraction: Rick N. Bruns / SNES Maps'};
 const crops={city:{file:'stage1.png',left:512,top:16,width:1280,height:224},factory:{file:'stage3.png',left:0,top:2048,width:1280,height:224},hive:{file:'stage6.png',left:0,top:1280,width:1280,height:224}};
 for(const[id,crop]of Object.entries(crops)){
  const {file,...rect}=crop;const source=await sharp(path.join(out,'sfc-source',file)).extract(rect).resize(640,112,{kernel:'nearest'}).raw().ensureAlpha().toBuffer();
  const coarse=await sharp(source,{raw:{width:640,height:112,channels:4}}).resize(1280,224,{kernel:'nearest'}).raw().toBuffer();
  // Neutral city masonry uses the blue FC palette; warm pipes retain the ochre palette.
  if(id==='city')for(let i=0;i<coarse.length;i+=4)if(coarse[i]<coarse[i+2]*1.15+4){coarse[i]=Math.round(coarse[i]*.35);coarse[i+1]=Math.round(coarse[i+1]*.65);coarse[i+2]=Math.min(255,Math.round(coarse[i+2]*1.3));}
  // Keep the terrain lane visually unambiguous; gameplay platforms are drawn above it.
  for(let y=184;y<224;y++)for(let x=0;x<1280;x++){const i=(y*1280+x)*4;coarse[i]=coarse[i+1]=coarse[i+2]=0;coarse[i+3]=255;}
  const chosen=id==='city'?[0,1]:id==='factory'?[1,3]:[2,1];const q=quantize(coarse,1280,224,chosen.map(i=>colors[i])),chunks=[];q.attributes=q.attributes.map(i=>chosen[i]);
  for(let y=0;y<7;y++)for(let x=0;x<40;x++){const tile=Buffer.alloc(32*32*4);for(let row=0;row<32;row++)q.data.copy(tile,row*128,((y*32+row)*1280+x*32)*4,((y*32+row)*1280+x*32+32)*4);const key=id+'-'+(y*40+x);chunks.push(key);css.push(`.spirits-chunk-${key}{background:${pixelGradients(tile,32,32,true)}}`);}
  manifest.stages[id]={width:1280,crop,art:{cols:40,chunks,prefix:'spirits-chunk-'},attributes:q.attributes,rgbaSha256:crypto.createHash('sha256').update(q.data).digest('hex')};
  if(process.env.SPIRITS_PREVIEW_DIR)await sharp(q.data,{raw:{width:1280,height:224,channels:4}}).png().toFile(path.join(process.env.SPIRITS_PREVIEW_DIR,id+'-fc.png'));
 }
 const sprites={kimkoh:['Stage1BossBeastKimkoh.png',80,84,1],bob1:['Stage3BossBOB1.png',44,62,3],bob2:['Stage3BossBOB2.png',44,62,2],brain:['Stage6BossAlienBrain.png',48,42,1],armored:['Stage6BossArmoredAlienBrain.png',112,62,2],H:['HomingGun.png',24,12,1],C:['CrushGun.png',24,12,1],F:['FireGun.png',24,12,1],L:['LaserGun.png',24,12,1],S:['SpreadGun.png',24,12,1],B:['Barrier.png',24,12,1]};
 for(const[id,[file,w,h,p]]of Object.entries(sprites)){
  const raw=await sharp(path.join(out,'sfc-source',file)).resize(w,h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer(),q=quantize(raw,w,h,[colors[p]],Math.max(w,h));
  manifest.assets['spirits_'+id]={width:w,height:h,file,palette:palettes[p]};css.push(`.art-spirits_${id}{width:${w}px;height:${h}px;background:${pixelGradients(q.data,w,h)}}`);
 }
 fs.writeFileSync(path.join(out,'spirits-art.css'),css.join('\n'));
 fs.writeFileSync(path.join(out,'spirits-art.json'),JSON.stringify(manifest));
 fs.writeFileSync(path.join(out,'spirits-art.js'),'window.SpiritsArt='+JSON.stringify(manifest)+';\n');
 console.log('FC scenes: 3 × 1280 × 224; four palettes; 16×16 attribute cells; '+Object.keys(manifest.assets).length+' CSS sprites.');
}
if(require.main===module)build().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={build,quantize,palettes};

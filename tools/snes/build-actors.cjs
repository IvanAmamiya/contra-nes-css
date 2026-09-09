// SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {snapshot,ppu}=require('./snapshot.cjs'),{decodeTiles}=require('./konami.cjs'),{pixelGradients}=require('../build-css-assets.cjs'),{quantize}=require('../build-spirits-art.cjs');
function compose(file,filter,anchorX,anchorY,mirror=false){
 const b=snapshot(file),p=ppu(b.PPU),indices=decodeTiles(b.VRA),palette=p.palette.map(n=>[n&31,n>>5&31,n>>10&31].map(c=>Math.floor(c*255/31)));
 const sprites=p.sprites.map(s=>({...s,x:s.x>32767?s.x-65536:s.x,size:s.large?16:8})).filter(s=>s.x>-100&&s.x<320).filter(filter);
 if(!sprites.length)throw Error('No sprites in '+file);
 const left=Math.min(...sprites.map(s=>s.x)),top=Math.min(...sprites.map(s=>s.y)),w=Math.max(...sprites.map(s=>s.x+s.size))-left,h=Math.max(...sprites.map(s=>s.y+s.size))-top,data=Buffer.alloc(w*h*4);
 for(const s of sprites.slice().reverse())for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
  const ox=s.flipX?s.size-1-x:x,oy=s.flipY?s.size-1-y:y,name=(s.tile&0x100)|((s.tile+(ox>>3)+(oy>>3)*16)&255),at=(p.obj.base+(name&255)*32+(name&256?8192+p.obj.select:0))&65535;
  const c=indices[(at>>5)*64+(oy&7)*8+(ox&7)];if(c)data.set([...palette[128+s.palette*16+c],255],((s.y+y-top)*w+(mirror?w-1-(s.x+x-left):s.x+x-left))*4);
 }
 return{data,width:w,height:h,anchorX:mirror?w-(anchorX-left):anchorX-left,anchorY:anchorY-top};
}
async function build(work,out){
 const assets={},animations={},css=['/* Original Contra III OAM poses; FC palette reduction; no raster at runtime. */'],previews=[];
 function add(id,file,filter,ax,ay,mirror=false,palette){
  const s=compose(file,filter,ax,ay,mirror),q=quantize(s.data,s.width,s.height,palette?[palette]:undefined,Math.max(s.width,s.height));
  assets[id]={width:s.width,height:s.height,anchorX:s.anchorX,anchorY:s.anchorY,source:path.basename(path.dirname(file))+'/'+path.basename(file),rgbaSha256:crypto.createHash('sha256').update(s.data).digest('hex')};
  css.push(`.art-${id}{width:${s.width}px;height:${s.height}px;background:${pixelGradients(q.data,s.width,s.height)}}`);
  previews.push({id,...s,data:q.data});return id;
 }
 const playerPalette=[[0,0,0],[0,120,168],[248,184,0],[248,248,248]];
 const groups={idle:[0],walk:[32,36,40,44,48,52,56],roll:[64,68,72,76,80,84,88,92],prone:[180],up:[212],upwalk:[244,248,252,256,260,264],downwalk:[324,328,332,336]};
 for(const [pose,frames]of Object.entries(groups))animations[pose]=frames.map((frame,i)=>{
  const file=path.join(work,'city-measure',`state-${frame}.bin`),b=snapshot(file),s=b.SRA,p=ppu(b.PPU),player=p.sprites.filter(s=>s.palette===5&&s.y<224),mirror=pose==='prone'||pose==='up';
  return add('c3_player_'+pose+'_'+i,file,o=>o.palette===5&&o.y<224,b.SRA.readUInt16LE(0x206),b.SRA.readUInt16LE(0x20e),mirror,playerPalette);
 });
 animations.runner=[];
 for(const frame of [360,420,480,540,600,660]){
  const file=path.join(work,'city-walk',`state-${frame}.bin`),b=snapshot(file),s=b.SRA,ax=s.readInt16LE(0x34a),ay=s.readInt16LE(0x34e);
  animations.runner.push(add('c3_runner_'+frame,file,o=>o.palette===2&&o.y>ay-52&&o.y<ay&&o.x>ax-25&&o.x<ax+25,ax,ay));
 }
 const carFile=path.join(work,'car-measure','state-80.bin');
 add('c3_car',carFile,o=>o.palette===7&&o.tile>=0x170&&o.y>=160,165,208);
 const capFile=path.join(work,'city-measure','state-160.bin');
 add('c3_capsule',capFile,o=>o.palette===7&&o.tile>=0xe0&&o.tile<=0xef&&o.y<60,136,31);
 const turretFile=path.join(work,'city-walk','state-480.bin');
 add('c3_turret',turretFile,o=>o.palette===3&&o.y>32&&o.y<92&&o.x>225,249,72);
 const dogFile=path.join(work,'city-walk','state-840.bin');
 add('c3_dog',dogFile,o=>o.palette===4&&o.y>168&&o.y<202&&o.x>32&&o.x<104,69,200);
 for(const [code,gun,tile,frame]of [['M',0,0xc,8],['S',1,0xd,8],['H',3,0x20,8],['C',2,0x24,8],['L',5,0x30,8]]){
  const file=path.join(work,`gun-${gun}`,`state-${frame}.bin`),p=ppu(snapshot(file).PPU),shots=p.sprites.filter(o=>o.palette===(gun===2||gun===5?0:7)&&o.y>130&&o.y<195&&o.x>100&&o.x<220);
  const first=shots[0];if(first)add('c3_shot_'+code,file,o=>o.x===first.x&&o.y===first.y&&o.tile===first.tile,first.x+(first.large?8:4),first.y+(first.large?8:4));
 }
 const boss=await require('sharp')(path.join(out,'sfc-source','Stage1BossBeastKimkoh.png')).ensureAlpha().raw().toBuffer();
 // Preserve the red heart as a readable weak point after FC palette reduction.
 // Each 16x16 cell still uses one four-colour group, without painting new pixels.
 const bossFc=Buffer.alloc(boss.length),bossBlue=[[0,0,0],[0,24,72],[0,120,168],[88,216,248]],bossWarm=[[0,0,0],[48,32,32],[168,80,0],[248,184,0]],bossRed=[[0,0,0],[88,0,0],[216,40,0],[248,184,0]];
 for(let y=0;y<168;y+=16)for(let x=0;x<160;x+=16){
  const height=Math.min(16,168-y),cell=Buffer.alloc(16*height*4);let red=0;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<16;xx++){
   const at=((y+yy)*160+x+xx)*4,i=(yy*16+xx)*4;cell.set(boss.subarray(at,at+4),i);
   if(cell[i+3]&&cell[i]>100&&cell[i]>cell[i+1]*2&&cell[i]>cell[i+2]*2)red++;
   if(cell[i]<cell[i+2]*1.15+4){cell[i]=Math.round(cell[i]*.35);cell[i+1]=Math.round(cell[i+1]*.65);cell[i+2]=Math.min(255,Math.round(cell[i+2]*1.3));}
  }
  const q=quantize(cell,16,height,red>4?[bossRed]:[bossBlue,bossWarm],16).data;
  for(let yy=0;yy<height;yy++)q.copy(bossFc,((y+yy)*160+x)*4,yy*64,(yy+1)*64);
 }
 assets.c3_kimkoh={width:160,height:168,anchorX:0,anchorY:0,source:'SNES Maps sprite extraction, native dimensions; not captured in this ROM trace'};
 css.push(`.art-c3_kimkoh{width:160px;height:168px;background:${pixelGradients(bossFc,160,168)}}`);
 const manifest={assets,animations,source:'Local SA-1 ROM OAM poses plus separately credited boss extraction; FC recoloring'};
 fs.writeFileSync(path.join(out,'spirits-actors.css'),css.join('\n'));fs.writeFileSync(path.join(out,'spirits-actors.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(out,'spirits-actors.js'),'window.SpiritsActors='+JSON.stringify(manifest)+';\n');
 if(process.env.ROM_PREVIEW_DIR){const sharp=require('sharp'),w=640,h=Math.ceil(previews.length/10)*96,b=Buffer.alloc(w*h*4);for(let i=0;i<previews.length;i++){let s=previews[i],xx=i%10*64,yy=Math.floor(i/10)*96;for(let y=0;y<Math.min(s.height,96);y++)s.data.copy(b,((yy+y)*w+xx)*4,y*s.width*4,(y*s.width+Math.min(s.width,64))*4);}await sharp(b,{raw:{width:w,height:h,channels:4}}).flatten({background:'#181828'}).png().toFile(path.join(process.env.ROM_PREVIEW_DIR,'rom-actors.png'));}
 console.log(Object.keys(assets).length+' ROM actor poses exported');
}
if(require.main===module)build(...process.argv.slice(2)).catch(e=>{console.error(e);process.exitCode=1;});module.exports={compose,build};

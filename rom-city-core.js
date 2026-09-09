/* Contra III city reconstruction. Measured rules are documented in ROM_CITY.md. */
(function(r,f){const node=typeof module==='object'&&module.exports;
 const api=f(node?require('./core.js'):r.ContraCore,node?require('./spirits-core.js'):r.ContraSpirits,node?require('./assets/spirits-city.js'):r.SpiritsCity);
 if(node)module.exports=api;else r.ContraRomCity=api;
})(typeof window!=='undefined'?window:this,function(C,S,DATA){
'use strict';
const {clamp,overlap,Character,Bullet,Player,GameWorld}=C;
const PHYSICS=Object.freeze({walk:360/256*60,jump:-6*60,gravity:.25*3600,cameraAnchor:127});
const SPEED=0x76666/65536*60;
const GUNS=Object.freeze({M:{frames:3,limit:10,damage:2},S:{frames:4,limit:10,damage:2},C:{frames:5,limit:3,damage:4},H:{frames:4,limit:5,damage:2},L:{frames:1,limit:8,damage:3},F:{frames:2,limit:10,damage:2}});
const SPREAD=[[-2,0x6d632/65536,-0x2d4f4/65536],[-1,0x741ff/65536,-0x17194/65536],[0,0x76666/65536,0],[1,0x741ff/65536,0x17194/65536],[2,0x6d632/65536,0x2d4f4/65536]];
class RomBullet extends S.SpiritsBullet {
 constructor(x,y,angle,code){super(x,y,angle,code);this.vx=Math.cos(angle)*SPEED;this.vy=Math.sin(angle)*SPEED;this.damage=GUNS[code].damage;this.life=2;this.kind={M:'machine',S:'spread',C:'crush',H:'homing',L:'laser',F:'flame'}[code];this.rom=true;this.hitFrames=new Map();}
 steer(world,dt){if(this.code!=='H')return;const targets=[...world.enemies,...world.capsules,...world.boss.parts].filter(e=>e.alive&&e.x>=world.camera&&e.x<world.camera+256&&(!e.isBoss||world.boss.activated));if(!targets.length)return;targets.sort((a,b)=>Math.hypot(a.cx-this.cx,a.cy-this.cy)-Math.hypot(b.cx-this.cx,b.cy-this.cy));const t=targets[0],delta=Math.atan2(Math.sin(Math.atan2(t.cy-this.cy,t.cx-this.cx)-this.angle),Math.cos(Math.atan2(t.cy-this.cy,t.cx-this.cx)-this.angle));this.angle+=clamp(delta,-dt*6,dt*6);this.vx=Math.cos(this.angle)*SPEED;this.vy=Math.sin(this.angle)*SPEED;}
}
class RomWeapon {
 constructor(code='M'){this.code=GUNS[code]?code:'M';this.nextFireTime=0;this.groups=[];this.serial=0;}
 tryFire(ctx){
  this.groups=this.groups.filter(g=>g.some(b=>b.alive));const active=this.groups.flat().filter(b=>b.alive).length,d=GUNS[this.code];
  if(!ctx.held||ctx.time+1e-9<this.nextFireTime)return[];
  this.nextFireTime=ctx.time+d.frames/60;
  if(this.code==='S'?this.groups.length>=2:this.code==='C'?this.groups.length>=3:this.code==='L'?active>0:active>=d.limit)return[];
  let offsets=this.code==='S'?[-Math.PI/8,-Math.PI/16,0,Math.PI/16,Math.PI/8]:this.code==='H'?[([0,1,-1,2,-2][this.serial%5])*Math.PI/32]:this.code==='L'?Array(8).fill(0):[0];
  const group=offsets.map((a,i)=>{const b=new RomBullet(ctx.x,ctx.y,ctx.angle+a,this.code);if(this.code==='S'){
    // The ROM table uses signed 16.16 velocities; rotation preserves the measured fan.
    const [_,vx,vy]=SPREAD[i];b.vx=(vx*Math.cos(ctx.angle)-vy*Math.sin(ctx.angle))*60;b.vy=(vx*Math.sin(ctx.angle)+vy*Math.cos(ctx.angle))*60;
   }if(this.code==='L'){b.x-=Math.cos(ctx.angle)*16*i;b.y-=Math.sin(ctx.angle)*16*i;b.muzzle={x:ctx.x,y:ctx.y};}
   if(this.code==='F'){b.vx=Math.cos(ctx.angle)*180;b.vy=Math.sin(ctx.angle)*180;b.life=.52;}
   return b;});
  this.serial++;this.groups.push(group);return group;
 }
}
class RomPlayer extends S.SpiritsPlayer {
 constructor(){super(50,160);this.w=12;this.h=40;this.slots=[new RomWeapon(),new RomWeapon()];this.weapon=this.slots[0];this.poseFrame=0;this.jumpAge=0;this.rom=true;}
 equip(weapon){this.slots[this.activeSlot]=weapon instanceof RomWeapon?weapon:new RomWeapon(weapon.code);this.weapon=this.slots[this.activeSlot];}
 update(dt,input,world){
  if(this.respawnTimer>0){this.respawnTimer=Math.max(0,this.respawnTimer-dt);if(this.respawnTimer<1e-9)world.respawn();this.wasJump=!!input.jump;this.wasSwap=!!input.swap;this.wasBomb=!!input.bomb;return;}
  this.invincible=Math.max(0,this.invincible-dt);this.barrier=Math.max(0,this.barrier-dt);if(this.invincible<1e-9)this.invincible=0;if(this.barrier<1e-9)this.barrier=0;
  this.dropTimer=Math.max(0,this.dropTimer-dt);this.gripCooldown=Math.max(0,this.gripCooldown-dt);
  if(input.swap&&!this.wasSwap){this.activeSlot=1-this.activeSlot;this.weapon=this.slots[this.activeSlot];world.emit('swap',{code:this.weapon.code});}
  if(input.bomb&&!this.wasBomb)world.bomb();this.wasSwap=!!input.swap;this.wasBomb=!!input.bomb;
  const axis=+!!input.right-+!!input.left,up=input.up&&!input.down,down=input.down&&!input.up;
  if(axis)this.facing=axis;
  this.spinning=!!input.spin;this.prone=this.grounded&&down&&!axis&&!this.spinning;
  this.resize(this.prone?32:12,this.prone?12:40);
  this.vx=this.prone||input.lock||this.spinning?0:axis*PHYSICS.walk;
  const launch=input.jump&&!this.wasJump;
  if(launch&&this.clinging){this.clinging=null;this.gripCooldown=.3;this.vy=down?90:PHYSICS.jump;this.justJumped=!down;this.jumpAge=0;}
  else if(launch&&this.grounded){
   if(down&&this.support&&this.support.y<192){this.dropTimer=.22;this.y+=2;this.vy=60;}
   else{this.vy=PHYSICS.jump;this.justJumped=true;this.jumpAge=0;world.emit('jump',{x:this.cx,y:this.y});}
   this.grounded=false;this.prone=false;this.resize(12,40);
  }
  if(!this.clinging&&up&&this.gripCooldown===0)this.clinging=world.level.grips.find(g=>overlap(this,{x:g.x-4,y:g.y-4,w:g.w+8,h:g.h+8}))||null;
  if(this.clinging){const g=this.clinging;this.x=clamp(this.x+axis*48*dt,g.x-6,g.x+g.w-6);this.y=g.type==='ceiling'?g.y+4:clamp(this.y+(+!!down-+!!up)*48*dt,g.y-16,g.y+g.h-this.h);this.vy=0;this.grounded=false;}
  else world.collision.move(this,dt,world.level);
  this.x=clamp(this.x,world.camera,world.level.width-this.w);if(this.y>248){world.hurtPlayer(true);return;}
  this.poseFrame+=dt*60;if(!this.grounded)this.jumpAge+=dt*60;
  this.aim=up?(axis?Math.atan2(-1,axis):-Math.PI/2):down&&!this.prone?(axis?Math.atan2(1,axis):!this.grounded||this.clinging?Math.PI/2:this.facing<0?Math.PI:0):this.facing<0?Math.PI:0;
  this.wasJump=!!input.jump;this.wasFire=!!input.fire;
  const angles=this.spinning?[world.time*13,world.time*13+Math.PI]:[this.aim],feet=this.y+this.h;
  angles.forEach((angle,i)=>{const gun=this.spinning?this.slots[i]:this.weapon;
   const muzzleY=this.prone?feet-8:feet-27+(Math.sin(angle)<-.1?-12:Math.sin(angle)>.1?6:0);
   const shots=gun.tryFire({time:world.time,x:this.cx+Math.cos(angle)*(this.prone?24:16),y:muzzleY,angle,held:input.fire||input.turbo||this.spinning});
   world.bullets.push(...shots);if(shots.length){world.shots+=shots.length;world.emit('shot',{x:this.cx,y:muzzleY,code:gun.code});}
  });
 }
}
class RomCityLevel extends C.Level {
 constructor(){super();this.id='city';this.info=S.STAGES[0];this.width=DATA.width;this.bossX=7040;this.water=[];this.solids=[];this.platforms=[];this.grips=[];this.data={art:DATA.art,spirits:true,rom:true,sky:DATA.sky};
  for(let row=0;row<28;row++){
   let start=-1;for(let col=0;col<=896;col++){
    const code=col<896?DATA.collision[row*896+col]:0,above=row?DATA.collision[(row-1)*896+col]:0;
    const top=code===0x2002&&above!==0x2002;
    if(top&&start<0)start=col;
    if(!top&&start>=0){this.platforms.push({x:start*8,y:row*8,w:(col-start)*8,h:8,active:true,breakAt:Infinity});start=-1;}
    if(code===4)this.grips.push({x:col*8,y:row*8,w:8,h:8,type:'ceiling'});
    if(code&0x4000)this.platforms.push({x:col*8,y:row*8+4,w:8,h:8,active:true,breakAt:Infinity,slope:code});
   }
  }
  // Merge contiguous climbable cells so a character can traverse a rail without sticking to one tile.
  this.grips.sort((a,b)=>a.y-b.y||a.x-b.x);this.grips=this.grips.reduce((a,g)=>{let p=a.at(-1);if(p&&p.y===g.y&&p.x+p.w===g.x)p.w+=g.w;else a.push({...g});return a;},[]);
 }
 safeSpawn(camera){const x=camera+40,candidates=this.platforms.filter(p=>p.active&&p.w>=24&&p.x+p.w>camera+16&&p.x<camera+208&&p.y>=80&&p.y<=216).sort((a,b)=>Math.abs(clamp(x,a.x+8,a.x+a.w-8)-x)-Math.abs(clamp(x,b.x+8,b.x+b.w-8)-x)||b.y-a.y);if(candidates.length){const p=candidates[0];return{x:clamp(x,p.x+8,p.x+p.w-20),y:p.y-40};}return{x,y:40};}
}
class RomPickup extends S.SpiritsPickup {
 apply(world){if(!this.alive)return;this.alive=false;const p=world.player;if(this.code==='B')p.grantBarrier();else if(this.code==='bomb')p.bombs=Math.min(5,p.bombs+1);else p.equip(new RomWeapon(this.code));world.emit('pickup',{x:this.cx,y:this.cy,code:this.code});}
}
class RomCapsule extends Character {
 constructor(e){super(e.trigger+e.screenX-16,e.y-16,32,24,1,'enemy');this.originY=this.y;this.code=['M','S','C','H','F','L','B','bomb'][e.parameter&7];this.facing=e.screenX<0?1:-1;this.kind='capsule';this.flying=true;this.age=0;this.rom=true;}
 update(dt,world){this.age+=dt;this.x+=this.facing*120*dt;this.y=this.originY+Math.sin(this.age*3.4)*15;if(this.cx<world.camera-40||this.x>world.camera+300)this.alive=false;}
 onDeath(world){world.pickups.push(new RomPickup(this.cx-7,this.cy-6,this.code));world.emit('explosion',{x:this.cx,y:this.cy});}
}
class RomEnemy extends Character {
 constructor(x,feet,kind='runner',facing=-1){const car=kind==='car';super(x-(car?28:8),feet-(car?48:40),car?56:16,car?48:40,car?3:kind==='sentry'?7:kind==='dog'?3:1,'enemy');Object.assign(this,{kind,facing,rom:true,age:0,nextShot:1.2,poseFrame:0});}
 update(dt,world){this.flash=Math.max(0,this.flash-dt);this.age+=dt;this.poseFrame+=dt*60;
  if(this.x+this.w<world.camera-48||this.x>world.camera+320||this.y>256){this.alive=false;return;}
  if(this.kind==='runner'||this.kind==='dog'){this.vx=this.facing*(this.kind==='dog'?120:this.facing===1?99.375:84.375);world.collision.move(this,dt,world.level);}
  if(this.kind==='car')return;
  if(this.kind==='sentry'){this.facing=world.player.cx<this.cx?-1:1;if(this.age>=this.nextShot){this.nextShot=this.age+1.6;const angle=Math.atan2(world.player.cy-this.cy,world.player.cx-this.cx);world.bullets.push(new Bullet(this.cx,this.cy,angle,'enemy',96));}}
 }
 onDeath(world){world.kills++;world.addScore(this.kind==='car'?100:this.kind==='sentry'?200:100);world.emit('explosion',{x:this.cx,y:this.cy,big:this.kind==='car'});}
}
class RomGate extends Character {
 constructor(event){super(event.trigger+event.screenX+12,164,24,24,96,'enemy');this.kind='wall-core';this.rom=true;this.renderInMap=true;this.age=0;this.nextShot=.8;this.lock=event.trigger+80;this.clearX=event.screen===7?2208:3232;}
 update(dt,world){this.age+=dt;this.flash=Math.max(0,this.flash-dt);if(this.age>this.nextShot){this.nextShot=this.age+1.4;for(const y of [112,144]){const a=Math.atan2(world.player.cy-y,world.player.cx-this.x);world.bullets.push(new Bullet(this.x-12,y,a,'enemy',90));}}}
 onDeath(world){world.level.removedWalls.push(this.clearX);world.level.artRevision++;world.level.platforms.push({x:this.clearX,y:200,w:96,h:24,active:true,breakAt:Infinity});world.addScore(3000);world.kills++;world.emit('explosion',{x:this.cx,y:144,big:true});}
}
class ShellSpawn extends Character {
 constructor(x,y,flying){super(x,y,12,12,2,'enemy');this.kind='shell-spawn';this.rom=true;this.flying=flying;this.vx=-84;this.originY=y;this.age=0;this.nativeArt='c3_shot_C';}
 update(dt,world){this.age+=dt;if(this.flying){this.x+=this.vx*dt;this.y=this.originY+Math.sin(this.age*5)*20;}else world.collision.move(this,dt,world.level);if(this.x<world.camera-20||this.y>256)this.alive=false;}
 onDeath(world){world.addScore(100);world.emit('explosion',{x:this.cx,y:this.cy});}
}
class TortoiseBoss extends Character {
 constructor(){super(7050,156,28,32,240,'enemy');this.kind='kimkoh';this.isBoss=true;this.nativeArt='c3_kimkoh';this.visualX=6992;this.visualY=40;this.age=0;this.nextShot=1.8;this.cycle=0;this.phase=1;}
 update(dt,world){this.flash=Math.max(0,this.flash-dt);if(!world.boss.activated)return;this.age+=dt;this.telegraph=this.nextShot-this.age<.4;
  if(this.age>=this.nextShot){this.nextShot=this.age+2.4;this.cycle++;const flying=this.cycle%2===1;for(let i=0;i<3;i++)world.enemies.push(new ShellSpawn(this.visualX+100+i*18,flying?64:160,flying));world.emit('bossShot',{x:this.cx,y:this.cy});}
 }
 takeDamage(n,w){if(!w.boss.activated)return false;return super.takeDamage(n,w);}
 onDeath(world){world.addScore(5000);world.kills++;world.boss.alive=false;world.bullets=[];for(const e of world.enemies)e.alive=false;world.clearTimer=1.8;world.emit('explosion',{x:this.cx,y:this.cy,big:true});world.emit('bossDead',{});}
}
class RomCollision extends S.SpiritsCollision {
 move(body,dt,level){
  body.x+=body.vx*dt;const bottom=body.y+body.h;
  if(body.justJumped){body.justJumped=false;body.vy+=PHYSICS.gravity*dt;body.grounded=false;body.support=null;return;}
  body.y+=body.vy*dt;body.vy=Math.min(360,body.vy+PHYSICS.gravity*dt);body.grounded=false;body.support=null;
  if(body.vy<0||body.dropTimer>0)return;
  let landing=null;for(const p of level.platforms){if(!p.active||body.cx<p.x||body.cx>=p.x+p.w||bottom>p.y+.01||body.y+body.h<p.y)continue;if(!landing||p.y<landing.y)landing=p;}
  if(landing){body.y=landing.y-body.h;body.vy=0;body.grounded=true;body.support=landing;}
 }
 updateBullets(world,dt){
  for(const b of world.bullets.slice()){
   if(!b.alive)continue;const x=b.cx,y=b.cy;b.steer?.(world,dt);b.update(dt);
   if(b.code==='C'&&b.age+1e-9>=15/60&&!b.exploding){b.exploding=true;b.vx=b.vy=0;b.life=35/60;world.emit('explosion',{x:b.cx,y:b.cy,big:true});}
   if(b.muzzle){b.hiddenByMuzzle=(b.cx-b.muzzle.x)*Math.cos(b.angle)+(b.cy-b.muzzle.y)*Math.sin(b.angle)<0;if(b.hiddenByMuzzle)continue;}
   const targets=b.team==='player'?[...world.enemies,...world.capsules,...world.boss.parts]:world.player.respawnTimer>0?[]:[world.player];
   for(const t of targets){
    if(!t.alive||t.isBoss&&!world.boss.activated)continue;
    const box=t.hitbox||t,hit=b.exploding?Math.hypot(clamp(b.cx,box.x,box.x+box.w)-b.cx,clamp(b.cy,box.y,box.y+box.h)-b.cy)<=20:this.segmentHit(x,y,b.cx,b.cy,box,b.kind==='flame'?6:2)!==null;
    if(!hit)continue;
    if(b.exploding||b.code==='F'){if(b.hitFrames.get(t)>world.frame-2)continue;b.hitFrames.set(t,world.frame);t.takeDamage(b.exploding?4:2,world);}
    else if(b.code==='C'){b.exploding=true;b.vx=b.vy=0;b.life=35/60;world.emit('explosion',{x:b.cx,y:b.cy,big:true});t.takeDamage(4,world);break;}
    else{t.takeDamage(b.damage,world);b.alive=false;world.emit('hit',{x:b.cx,y:b.cy});break;}
   }
   if(b.life<1e-9||b.cx<world.camera-16||b.cx>=world.camera+(b.team==='player'?248:272)||b.cy<-24||b.cy>248)b.alive=false;
  }
 }
}
class RomCityWorld extends GameWorld {
 constructor(seed=1337){super(seed);}
 reset(state='playing',lives=30){
  super.reset(state,clamp(Number(lives)||30,1,30));this.stageId='city';this.frame=0;this.level=new RomCityLevel();this.level.removedWalls=[];this.level.artRevision=0;this.player=new RomPlayer();this.collision=new RomCollision();this.enemies=[];this.capsules=[];this.pickups=[];this.gates=[];this.eventIndex=0;this.runnerEnabled=false;this.nextRunner=Infinity;this.nextSpawn=Infinity;this.bombFlash=0;
  const boss=new TortoiseBoss();
  this.boss={x:7064,activated:false,alive:true,parts:[boss]};
 }
 addScore(value){S.SpiritsWorld.prototype.addScore.call(this,value);}
 bomb(){return S.SpiritsWorld.prototype.bomb.call(this);}
 hurtPlayer(fall=false){const hit=super.hurtPlayer(fall);if(hit){this.player.bombs=1;this.player.clinging=null;this.player.gripCooldown=.3;}return hit;}
 respawn(){super.respawn();this.player.resize(12,40);this.player.y+=10;this.player.invincible=S.PROTECTION.respawnFrames/60;}
 spawnEvents(){
  while(this.eventIndex<DATA.events.length&&DATA.events[this.eventIndex].trigger<=this.camera){const e=DATA.events[this.eventIndex++],x=e.trigger+e.screenX;
   if(e.type===15)this.capsules.push(new RomCapsule(e));
   else if(e.type===17)this.enemies.push(new RomEnemy(x,e.y,'car'));
   else if(e.type===18||e.type===23)this.enemies.push(new RomEnemy(x,e.y,'sentry'));
   else if(e.type===30)this.enemies.push(new RomEnemy(x,e.y,'dog',-1));
   else if(e.type===4){const gate=new RomGate(e);this.gates.push(gate);this.enemies.push(gate);}
   else if(e.type===11){this.runnerEnabled=true;this.nextRunner=this.time+1.0;}
  }
  if(this.runnerEnabled&&this.time>=this.nextRunner&&this.camera<this.level.width-320){
   this.nextRunner=this.time+(62+Math.floor(this.random.next()*56))/60;
   const facing=this.random.next()<.28?1:-1,x=this.camera+(facing===1?-16:272),surface=this.level.platforms.filter(p=>p.active&&x>=p.x&&x<p.x+p.w&&p.y>=128).sort((a,b)=>b.y-a.y)[0];
   if(surface)this.enemies.push(new RomEnemy(x,surface.y,'runner',facing));
  }
 }
 update(dt,input={}){
  if(!Number.isFinite(dt)||dt<=0||this.state!=='playing')return;dt=Math.min(dt,.05);this.time+=dt;this.frame++;
  if(this.clearTimer>0){this.clearTimer=Math.max(0,this.clearTimer-dt);if(this.clearTimer<1e-9){this.clearTimer=0;this.state='won';this.emit('win',{});}return;}
  this.player.update(dt,input,this);if(this.state!=='playing')return;
  this.farthest=Math.max(this.farthest,this.player.x);const gate=this.gates.find(g=>g.alive),maxCamera=gate?gate.lock:this.level.width-256;this.camera=Math.max(this.camera,clamp(Math.floor(this.player.cx)-PHYSICS.cameraAnchor,0,maxCamera));
  if(gate)this.player.x=Math.min(this.player.x,gate.x-this.player.w-8);
  if(this.camera===this.level.width-256&&!this.boss.activated){this.boss.activated=true;this.emit('boss',{});}
  if(this.boss.alive)this.player.x=Math.min(this.player.x,this.boss.x-this.player.w-3);
  this.spawnEvents();for(const e of [...this.enemies,...this.capsules,...this.pickups,...this.boss.parts])if(e.alive)e.update(dt,this);
  this.collision.updateBullets(this,dt);if(this.clearTimer>0)return;
  if(!this.player.respawnTimer){
   for(const e of this.enemies)if(e.alive&&overlap(this.player,e)){if(this.player.barrier>0)e.takeDamage(e.hp,this);else this.player.takeDamage(1,this);break;}
   for(const p of this.pickups)if(p.alive&&overlap(this.player,p))p.apply(this);
   for(const b of this.boss.parts)if(b.alive&&this.boss.activated&&overlap(this.player,b))this.player.takeDamage(1,this);
  }
  this.enemies=this.enemies.filter(e=>e.alive);this.capsules=this.capsules.filter(e=>e.alive);this.pickups=this.pickups.filter(e=>e.alive);this.bullets=this.bullets.filter(e=>e.alive).slice(0,120);this.bombFlash=Math.max(0,this.bombFlash-dt);
 }
}
return{DATA,PHYSICS,GUNS,SPREAD,RomBullet,RomWeapon,RomPlayer,RomCityLevel,RomPickup,RomCapsule,RomEnemy,RomGate,TortoiseBoss,RomCollision,RomCityWorld};
});

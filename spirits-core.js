/* Contra III-inspired rules, independent of the DOM and of the unchanged NES rules. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.ContraCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.ContraSpirits=api;})(typeof window!=='undefined'?window:this,function(C){
'use strict';
const {clamp,overlap,Character,Bullet,Player,Enemy,Pickup,Level,GameWorld,CollisionSystem}=C;
const STAGES=[{id:'city',name:'城市废墟',boss:'BEAST KIMKOH',number:1},{id:'factory',name:'钢铁工厂',boss:'BOB · 双机兵',number:3},{id:'hive',name:'异形巢穴',boss:'ALIEN BRAIN',number:6}];
// Measured on the identified local SA-1 ROM. See ROM_ANALYSIS.md and its trace fixture.
const PROTECTION=Object.freeze({barrierFrames:512,respawnFrames:96});
const WEAPONS={M:{interval:.12,speed:240,kind:'machine',damage:1},S:{interval:.23,speed:220,kind:'spread',damage:1},H:{interval:.18,speed:160,kind:'homing',damage:1},C:{interval:.3,speed:170,kind:'crush',damage:3},L:{interval:.14,speed:360,kind:'laser',damage:2},F:{interval:.07,speed:150,kind:'flame',damage:1}};
class SpiritsBullet extends Bullet {
 constructor(x,y,angle,code){const d=WEAPONS[code];super(x,y,angle,'player',d.speed,d.kind,d.damage);this.code=code;this.life=code==='F'?.48:1.7;this.pierced=new Set();}
 steer(world,dt){if(this.kind!=='homing')return;const targets=[...world.enemies,...world.boss.parts].filter(e=>e.alive&&e.x>=world.camera-10&&e.x<world.camera+256&&(e.team==='enemy')&&(!e.isBoss||world.boss.activated));if(!targets.length)return;targets.sort((a,b)=>Math.hypot(a.cx-this.cx,a.cy-this.cy)-Math.hypot(b.cx-this.cx,b.cy-this.cy));const t=targets[0],goal=Math.atan2(t.cy-this.cy,t.cx-this.cx),delta=Math.atan2(Math.sin(goal-this.angle),Math.cos(goal-this.angle));this.angle+=clamp(delta,-dt*4.2,dt*4.2);this.vx=Math.cos(this.angle)*160;this.vy=Math.sin(this.angle)*160;}
}
class SpiritsWeapon {
 constructor(code='M'){this.code=WEAPONS[code]?code:'M';this.nextFireTime=0;}
 tryFire(ctx){if(!(ctx.held||ctx.turbo)||ctx.time+1e-9<this.nextFireTime||ctx.activeCount>=40)return[];const d=WEAPONS[this.code];this.nextFireTime=ctx.time+d.interval;return(this.code==='S'?[-.32,-.16,0,.16,.32]:[0]).slice(0,40-ctx.activeCount).map(a=>new SpiritsBullet(ctx.x,ctx.y,ctx.angle+a,this.code));}
}
class SpiritsPlayer extends Player {
 constructor(x=32,y=154){super(x,y);this.invincible=PROTECTION.respawnFrames/60;this.slots=[new SpiritsWeapon('M'),new SpiritsWeapon('H')];this.activeSlot=0;this.weapon=this.slots[0];this.bombs=1;this.wasSwap=false;this.wasBomb=false;this.clinging=null;this.gripCooldown=0;this.spinning=false;}
 grantBarrier(){this.barrier=PROTECTION.barrierFrames/60;this.invincible=Math.max(this.invincible,this.barrier);}
 equip(weapon){this.slots[this.activeSlot]=weapon instanceof SpiritsWeapon?weapon:new SpiritsWeapon(weapon.code);this.weapon=this.slots[this.activeSlot];}
 update(dt,input,world){
  if(this.respawnTimer>0){super.update(dt,input,world);this.wasSwap=!!input.swap;this.wasBomb=!!input.bomb;return;}
  if(input.swap&&!this.wasSwap){this.activeSlot=1-this.activeSlot;this.weapon=this.slots[this.activeSlot];world.emit('swap',{code:this.weapon.code});}
  if(input.bomb&&!this.wasBomb)world.bomb();this.wasSwap=!!input.swap;this.wasBomb=!!input.bomb;
  this.gripCooldown=Math.max(0,this.gripCooldown-dt);const axis=Number(!!input.right)-Number(!!input.left),vertical=Number(!!input.down)-Number(!!input.up);
  const release=input.jump&&!this.wasJump&&this.clinging;
  if(release){this.clinging=null;this.gripCooldown=.3;this.vy=input.down?60:-180;this.grounded=false;}
  if(!this.clinging&&this.gripCooldown===0&&input.up){this.clinging=world.level.grips.find(g=>this.cx>g.x-6&&this.cx<g.x+g.w+6&&this.y<g.y+g.h&&this.y+this.h>g.y-8)||null;}
  const grip=this.clinging,oldMove=world.collision.move;
  if(grip){world.collision.move=(body,step,level)=>{if(body!==this)return oldMove.call(world.collision,body,step,level);body.vx=axis*48;body.vy=vertical*48;body.x=clamp(body.x+body.vx*step,grip.x-4,grip.x+grip.w-body.w+4);body.y=grip.type==='ceiling'?grip.y+4:clamp(body.y+body.vy*step,grip.y-12,grip.y+grip.h-body.h);body.grounded=false;body.support=null;};}
  const oldX=this.x;this.spinning=!!input.spin;
  // Base player retains its proven movement; firing is handled once below with locked aim or spin.
  try{super.update(dt,{...input,fire:false,turbo:false,jump:release?false:input.jump,down:grip?false:input.down},world);}finally{world.collision.move=oldMove;}
  if(this.barrier<1e-9)this.barrier=0;if(this.invincible<1e-9)this.invincible=0;
  if(this.respawnTimer>0||!this.alive)return;
  if(input.lock||this.spinning){this.x=oldX;this.vx=0;}
  if(grip&&vertical>0)this.aim=axis?Math.atan2(1,axis):Math.PI/2;
  const firing=input.fire||input.turbo||this.spinning;
  const count=world.bullets.filter(b=>b.alive&&b.team==='player').length;
  const angles=this.spinning?[world.time*13,world.time*13+Math.PI]:[this.aim];let shotCount=0;
  angles.forEach((angle,i)=>{const weapon=this.spinning?this.slots[i]:this.weapon;const shots=weapon.tryFire({time:world.time,x:this.cx+Math.cos(angle)*10,y:this.y+(this.prone?3:11)+Math.sin(angle)*9,angle,held:firing,activeCount:count+shotCount});world.bullets.push(...shots);shotCount+=shots.length;});
  if(shotCount){world.shots+=shotCount;world.emit('shot',{x:this.cx,y:this.cy,code:this.weapon.code});}this.wasFire=!!input.fire;this.wasJump=!!input.jump;
 }
}
class SpiritsPickup extends Pickup {
 update(dt,world){if(this.x>world.camera+256)return;super.update(dt,world);}
 apply(world){if(!this.alive)return;this.alive=false;const p=world.player;if(this.code==='B')p.grantBarrier();else if(this.code==='bomb')p.bombs=Math.min(5,p.bombs+1);else p.equip(new SpiritsWeapon(this.code));world.addScore(100);world.emit('pickup',{x:this.cx,y:this.cy,code:this.code});}
}
class SpiritsBoss extends Character {
 constructor(x,y,kind){const spec={kimkoh:[80,84,100],bob1:[44,62,55],bob2:[44,62,55],armored:[112,62,130]}[kind];super(x,y,...spec,'enemy');this.kind=kind;this.originX=x;this.originY=y;this.isBoss=true;this.age=0;this.phase=1;this.nextShot=1.4;this.telegraph=false;}
 update(dt,world){this.flash=Math.max(0,this.flash-dt);if(!world.boss.activated)return;this.age+=dt;this.phase=this.hp<=this.maxHp*.5?2:1;this.telegraph=this.nextShot-this.age<.4;
  if(this.kind.startsWith('bob')){this.x=this.originX+Math.sin(this.age*(this.phase===2?1.6:1)) * 18;this.y=this.originY-Math.max(0,Math.sin(this.age*1.8))*34;}
  if(this.kind==='armored'){this.w=this.phase===2?48:112;this.h=this.phase===2?42:62;this.x=this.originX+(this.phase===2?32:0);this.y=this.originY+(this.phase===2?20:0)+Math.sin(this.age*1.4)*18;}
  if(this.age>=this.nextShot){this.nextShot=this.age+(this.phase===2?.95:1.6);const aim=Math.atan2(world.player.cy-this.cy,world.player.cx-this.cx);const spread=this.kind==='armored'?[0,.3,-.3,.6,-.6]:this.kind==='kimkoh'?[0,.22,-.22]:[0,.16,-.16];for(const a of spread){if(world.bullets.filter(b=>b.team==='enemy').length>=80)break;world.bullets.push(new Bullet(this.x,this.cy,aim+a,'enemy',this.phase===2?90:66,'cannon'));}world.emit('bossShot',{x:this.cx,y:this.cy});}
 }
 takeDamage(amount,world){if(!world.boss.activated)return false;return super.takeDamage(amount,world);}
 onDeath(world){world.kills++;world.addScore(5000);world.emit('explosion',{x:this.cx,y:this.cy,big:true});if(world.boss.parts.every(p=>!p.alive)){world.boss.alive=false;world.clearTimer=1.8;world.bullets=[];world.emit('bossDead',{});}}
}
class SpiritsLevel extends Level {
 constructor(id='city'){super();this.id=STAGES.some(s=>s.id===id)?id:'city';this.info=STAGES.find(s=>s.id===this.id);this.width=1280;this.bossX=this.id==='hive'?1152:1176;this.water=[];this.solids=[];
  const gaps=this.id==='factory'?[[352,64],[736,64]]:this.id==='hive'?[[480,64],[848,48]]:[[448,48]];
  let edge=0;this.platforms=[];for(const[x,w]of gaps){this.platforms.push({x:edge,y:192,w:x-edge,h:32});edge=x+w;}this.platforms.push({x:edge,y:192,w:1280-edge,h:32});
  for(const[x,y,w]of (this.id==='factory'?[[256,150,80],[352,128,64],[432,128,96],[656,152,80],[752,128,64],[816,128,96]]:this.id==='hive'?[[240,152,80],[400,128,80],[608,152,96],[768,128,80]]:[[288,152,80],[528,152,96],[768,144,96]]))this.platforms.push({x,y,w,h:8,raised:true});
  this.platforms.forEach(p=>{p.active=true;p.breakAt=Infinity;});this.grips=this.id==='factory'?[{x:320,y:70,w:224,h:6,type:'ceiling'},{x:656,y:56,w:16,h:112,type:'wall'}]:[{x:720,y:86,w:192,h:6,type:'ceiling'}];
  this.data={art:{cols:40,chunks:Array.from({length:280},(_,i)=>this.id+'-'+i),prefix:'spirits-chunk-'},spirits:true};
 }
 createEnemies(){return[200,360,568,704,880,988].map((x,i)=>new Enemy(x,165,i%2?'rifleman':'runner',-1));}
 createCapsules(){return[];}
 createBossParts(){return this.id==='city'?[new SpiritsBoss(1176,108,'kimkoh')]:this.id==='factory'?[new SpiritsBoss(1168,130,'bob1'),new SpiritsBoss(1224,98,'bob2')]:[new SpiritsBoss(1152,116,'armored')];}
}
class SpiritsCollision extends CollisionSystem {
 updateBullets(world,dt){for(const b of world.bullets.slice()){
  if(!b.alive)continue;const x=b.cx,y=b.cy;b.steer?.(world,dt);b.update(dt);
  const targets=b.team==='player'?[...world.enemies,...world.boss.parts]:world.player.respawnTimer>0?[]:[world.player],hits=[];
  for(const t of targets){if(!t.alive||t.isBoss&&!world.boss.activated||b.pierced?.has(t))continue;const at=this.segmentHit(x,y,b.cx,b.cy,t,b.kind==='flame'?5:2);if(at!==null)hits.push({target:t,at});}hits.sort((a,b)=>a.at-b.at);
  for(const {target:hit,at}of(b.kind==='laser'?hits:hits.slice(0,1))){const hx=x+(b.cx-x)*at,hy=y+(b.cy-y)*at;hit.takeDamage(b.damage,world);world.emit('hit',{x:hx,y:hy});if(b.kind==='crush'){for(const t of targets)if(t!==hit&&t.alive&&Math.hypot(clamp(hx,t.x,t.x+t.w)-hx,clamp(hy,t.y,t.y+t.h)-hy)<34)t.takeDamage(2,world);world.emit('explosion',{x:hx,y:hy});}if(b.kind==='laser'){b.pierced.add(hit);b.damage=Math.max(1,b.damage-1);}else b.alive=false;}
  if(b.life<=0||b.x<world.camera-24||b.x>world.camera+280||b.y<-24||b.y>240)b.alive=false;
 }}
}
class SpiritsWorld extends GameWorld {
 constructor(stage='city',seed=1337){super(seed);this.stageId=stage;this.reset('title',30);}
 reset(state='playing',lives=30){super.reset(state,clamp(Number(lives)||30,1,30));this.level=new SpiritsLevel(this.stageId);this.collision=new SpiritsCollision();this.player=new SpiritsPlayer();this.enemies=this.level.createEnemies();this.capsules=[];this.pickups=[['B',64],['S',112],['C',272],['L',592],['F',720],['B',864],['H',944],['bomb',1040]].map(([code,x])=>new SpiritsPickup(x,160,code));this.boss={x:this.level.bossX,alive:true,activated:false,parts:this.level.createBossParts()};this.bombFlash=0;}
 respawn(){super.respawn();this.player.invincible=PROTECTION.respawnFrames/60;}
 addScore(value){this.score+=value;while(this.score>=this.nextExtraLife){this.lives=Math.min(30,this.lives+1);this.nextExtraLife+=60000;this.emit('extraLife',{});}}
 bomb(){if(this.player.bombs<=0||this.state!=='playing'||this.player.respawnTimer>0)return false;this.player.bombs--;this.bombFlash=.3;for(const b of this.bullets)if(b.team==='enemy')b.alive=false;for(const e of [...this.enemies,...this.boss.parts])if(e.alive&&e.x>=this.camera-32&&e.x<this.camera+256)e.takeDamage(e.isBoss?18:20,this);this.player.invincible=Math.max(this.player.invincible,.75);this.emit('bomb',{x:this.player.cx,y:this.player.cy,big:true});return true;}
 hurtPlayer(fall=false){const result=super.hurtPlayer(fall);if(result){this.player.bombs=1;this.player.clinging=null;this.player.gripCooldown=.3;}return result;}
 update(dt,input={}){if(!Number.isFinite(dt)||dt<=0||this.state!=='playing')return;dt=Math.min(dt,.05);super.update(dt,input);if(this.state!=='playing')return;this.bombFlash=Math.max(0,this.bombFlash-dt);if(!this.clearTimer&&this.boss.activated&&!this.player.respawnTimer)for(const b of this.boss.parts)if(b.alive&&overlap(b,this.player))this.player.takeDamage(1,this);this.bullets=this.bullets.filter(b=>b.alive).slice(0,120);}
}
return{STAGES,WEAPONS,PROTECTION,SpiritsBullet,SpiritsWeapon,SpiritsPlayer,SpiritsPickup,SpiritsBoss,SpiritsLevel,SpiritsCollision,SpiritsWorld};
});

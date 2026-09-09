'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../rom-city-core.js'),C=require('../core.js'),reference=require('./fixtures/city-logic-reference.json');
test('SA-1 台阶独立记录：111 帧横坐标与脚底坐标逐帧一致',()=>{
 const w=new R.RomCityWorld(),rows=reference.stairs,first=rows[0];
 w.player.x=first.x-w.player.w/2;w.player.y=first.feet-w.player.h;w.player.grounded=true;
 assert.equal(rows.length,112);
 for(const row of rows.slice(1)){w.time+=1/60;w.player.update(1/60,row,w);assert.equal(w.player.cx,row.x,'x frame '+row.frame);assert.equal(w.player.y+w.player.h,row.feet,'feet frame '+row.frame);}
 assert.equal(rows.find(r=>r.frame===94).feet,144);assert.equal(rows.find(r=>r.frame===128).feet,72);
});
test('金属台阶可以上跳、站立及下穿，站姿改变不移动脚底',()=>{
 const w=new R.RomCityWorld(),p=w.player;p.x=793-p.w/2;p.y=144-p.h;p.grounded=true;
 p.update(1/60,{},w);assert.equal(p.y+p.h,144);assert.ok(p.support);
 p.update(1/60,{down:true},w);assert.equal(p.h,9);assert.equal(p.y+p.h,144);
 p.update(1/60,{down:true,jump:true},w);assert.equal(p.grounded,false);
 for(let i=0;i<45;i++)p.update(1/60,{},w);assert.equal(p.y+p.h,200);
});
test('实体柱阻挡侧面，攀附可爬至柱顶，跳跃脱离',()=>{
 const w=new R.RomCityWorld(),p=w.player,s=w.level.solids.find(s=>s.x===5168&&s.y===48);
 assert.ok(s);w.camera=4992;p.x=s.x-p.w-1;p.y=144-p.h;p.grounded=false;p.vy=0;
 p.update(1/60,{right:true,up:true},w);assert.equal(p.x+p.w,s.x);assert.equal(p.clinging?.type,'wall');
 for(let i=0;i<130;i++)p.update(1/60,{up:true},w);
 assert.equal(p.clinging,null);assert.equal(p.y+p.h,48);assert.equal(p.grounded,true);
 p.update(1/60,{jump:true},w);assert.equal(p.grounded,false);assert.ok(p.vy<0);
});
test('小 Boss 击破当帧清敌弹与附近敌兵，保留补给、远处对象和关底 Boss',()=>{
 const w=new R.RomCityWorld();w.camera=2048;w.spawnEvents();const gate=w.gates[0];
 const near=new R.RomEnemy(2150,200),far=new R.RomEnemy(2600,200);w.enemies.push(near,far);
 const cap=new R.RomCapsule({trigger:2048,screenX:64,y:80,parameter:6});w.capsules.push(cap);
 const pickup=new R.RomPickup(2150,190,'S');w.pickups.push(pickup);w.player.invincible=0;w.player.x=2130;
 const killing=new R.RomBullet(gate.x-3,gate.cy,0,'M');killing.damage=999;
 const hostile=new C.Bullet(w.player.cx-1,w.player.cy,0,'enemy',90);w.bullets=[killing,hostile];
 const lives=w.lives;w.collision.updateBullets(w,1/60);
 assert.equal(gate.alive,false);assert.equal(near.alive,false);assert.equal(hostile.alive,false);assert.equal(w.lives,lives);
 assert.equal(far.alive,true);assert.equal(cap.alive,true);assert.equal(pickup.alive,true);assert.equal(w.boss.parts[0].alive,true);
 assert.equal(w.nextRunner,w.time+2);w.reset();assert.equal(w.encounterQuietUntil,0);
});

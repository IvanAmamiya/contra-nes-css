'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../core.js'),S=require('../spirits-core.js');
const fixture=require('./fixtures/contra3-protection.json');
const fresh=()=>{const w=new S.SpiritsWorld();w.reset();w.enemies=[];w.pickups=[];return w;};
test('B timer follows the ROM experiment for all 512 fixed updates, including expiry',()=>{
 const w=fresh();new S.SpiritsPickup(0,0,'B').apply(w);
 assert.equal(Math.round(w.player.barrier*60),fixture.barrier.initial);
 for(const row of fixture.barrier.afterUpdates){w.update(C.STEP,{});assert.equal(Math.round(w.player.barrier*60),row,'ROM countdown');}
 assert.equal(w.player.barrier,0);assert.equal(w.player.invincible,0);
 assert.equal(w.player.takeDamage(1,w),true);
});
test('B absorbs enemy bullets and boss contact, pause freezes it, refresh resets duration',()=>{
 const w=fresh();new S.SpiritsPickup(0,0,'B').apply(w);const lives=w.lives;
 w.bullets=[new C.Bullet(w.player.cx,w.player.cy,0,'enemy')];w.collision.updateBullets(w,C.STEP);
 assert.equal(w.lives,lives);w.boss.activated=true;const boss=w.boss.parts[0];boss.x=w.player.x;boss.y=w.player.y;w.update(C.STEP,{});assert.equal(w.lives,lives);
 w.togglePause();const before=w.player.barrier;for(let n=0;n<60;n++)w.update(C.STEP,{});assert.equal(w.player.barrier,before);
 new S.SpiritsPickup(0,0,'B').apply(w);assert.equal(w.player.barrier,fixture.barrier.initial/60);
});
test('Fall consumes life despite B; respawn and initial grace use measured 96 frames',()=>{
 const w=fresh();assert.equal(w.player.invincible,fixture.respawn.frames/60);w.player.grantBarrier();assert.equal(w.hurtPlayer(true),true);assert.equal(w.player.barrier,0);w.respawn();assert.equal(w.player.invincible,fixture.respawn.frames/60);
});
test('All stages place real B pickups on the normal route and bombs preserve the active gun',()=>{
 for(const stage of S.STAGES){const w=new S.SpiritsWorld(stage.id);w.reset();assert.ok(w.pickups.some(p=>p.code==='B'&&p.x<112));const gun=w.player.weapon;const b=w.player.bombs;w.pickups.find(p=>p.code==='bomb').apply(w);assert.equal(w.player.bombs,b+1);assert.equal(w.player.weapon,gun);assert.equal(w.player.barrier,0);}
});

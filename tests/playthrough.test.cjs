'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GameWorld,STEP}=require('../core.js'),Pilot=require('./pilot.js');
for(const seed of [1,7,27,42,123,256,512,1024,1337,9001])test(`完整首关 / 种子 ${seed}：30命模式通过正常按键击破核心`,()=>{
  const w=new GameWorld(seed);w.reset('playing',30);const pilot=new Pilot();let deaths=0,pickups=0,boss=false,frames=0;
  while(w.state==='playing'&&frames<18000){w.update(STEP,pilot.next(w));frames++;for(const e of w.drainEvents()){if(e.type==='death')deaths++;if(e.type==='pickup')pickups++;if(e.type==='boss')boss=true;}}
  assert.equal(w.state,'won',JSON.stringify({seed,x:w.player.x,y:w.player.y,lives:w.lives}));assert.ok(boss);assert.ok(pickups>=1);assert.ok(w.kills>0);assert.ok(w.shots>50);assert.ok(w.lives>0);assert.equal(w.camera,w.level.width-256);
  console.log(JSON.stringify({playthroughSeed:seed,frames,deaths,pickups,score:w.score,lives:w.lives}));
});
test('三命失败路线进入GAME OVER，重试后可完整通关',()=>{
  const w=new GameWorld(1337);w.reset();let p=new Pilot();for(let i=0;i<9000&&w.state==='playing';i++)w.update(STEP,p.next(w));assert.equal(w.state,'gameover');assert.equal(w.lives,0);
  w.reset('playing',30);p=new Pilot();for(let i=0;i<9000&&w.state==='playing';i++)w.update(STEP,p.next(w));assert.equal(w.state,'won');
});

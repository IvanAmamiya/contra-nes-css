'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');
const { STEP, GameWorld, Player, Enemy, Bullet, Capsule, Pickup, RifleWeapon, MachineWeapon, SpreadWeapon, LaserWeapon, FireWeapon, CollisionSystem, FixedClock, Random } = C;
const fresh = () => { const w = new GameWorld(); w.reset(); return w; };
const quiet = () => { const w = fresh(); w.enemies = []; w.capsules = []; w.nextSpawn = Infinity; return w; };
const tick = (w, count, input = {}) => { for (let i = 0; i < count; i++) w.update(STEP, typeof input === 'function' ? input(i, w) : input); };
const ctx = overrides => ({ time: 0, x: 30, y: 70, angle: 0, held: true, pressed: true, activeCount: 0, ...overrides });
const close = (a,b,t=.0001) => assert.ok(Math.abs(a-b)<t, `${a} ≠ ${b}`);

test('初始标题不运行物理；开始时重置为三条命', () => { const w = new GameWorld(); w.update(1,{right:true}); assert.equal(w.time,0); w.reset(); assert.equal(w.state,'playing'); assert.equal(w.lives,3); assert.equal(w.player.weapon.code,'N'); });
test('暂停冻结位置、子弹、射击计时与桥梁计时', () => { const w=quiet(); tick(w,20,{right:true,turbo:true}); w.togglePause(); const before=JSON.stringify(w); tick(w,200,{right:true,turbo:true}); assert.equal(JSON.stringify(w),before); w.togglePause(); w.update(STEP); assert.equal(w.state,'playing'); });
test('死亡和通关状态不能通过暂停意外复活', () => { const w=quiet(); for(const state of ['title','gameover','won']) {w.state=state;w.togglePause();assert.equal(w.state,state);} });
test('重开恢复敌人、胶囊、桥梁、分数与镜头', () => { const w=fresh(); w.level.platforms.find(p=>p.bridge).active=false; w.enemies=[];w.capsules=[];w.score=900;w.camera=400;w.player.equip(new SpreadWeapon());w.reset(); assert.equal(w.score,0);assert.equal(w.camera,0);assert.equal(w.enemies.length,18);assert.equal(w.capsules.length,7);assert.ok(w.level.platforms.every(p=>p.active));assert.equal(w.player.weapon.code,'N'); });
test('无效时间步不会污染状态',()=>{const w=quiet();for(const dt of [0,-1,NaN,Infinity])w.update(dt,{right:true});assert.equal(w.time,0);assert.equal(w.player.x,32);});
test('重开可选择三十命练习模式',()=>{const w=fresh();w.reset('playing',30);assert.equal(w.lives,30);});
test('角色站在草地上不下沉',()=>{const w=quiet();tick(w,600);close(w.player.y+w.player.h,96);assert.ok(w.player.grounded);});
test('行走速度按原作一像素每帧实现',()=>{const w=quiet();tick(w,60,{right:true});close(w.player.x,92);});
test('左右同时按下时保持原地',()=>{const w=quiet();tick(w,60,{right:true,left:true});close(w.player.x,32);});
test('起点左侧边界不能越出屏幕',()=>{const w=quiet();tick(w,120,{left:true});close(w.player.x,0);});
test('镜头向右推进，回头时不倒卷',()=>{const w=quiet();tick(w,180,{right:true});const cam=w.camera;assert.ok(cam>0);tick(w,240,{left:true});assert.equal(w.camera,cam);assert.ok(w.player.x>=cam);});
test('固定跳跃轨迹离开地面后重新落地',()=>{const w=quiet();w.update(STEP,{jump:true});assert.ok(w.player.vy<0);let min=w.player.y;for(let i=0;i<90;i++){w.update(STEP);min=Math.min(min,w.player.y);}assert.ok(min<20);close(w.player.y,66);assert.ok(w.player.grounded);});
test('长按跳跃不会自动二段跳或连跳',()=>{const w=quiet();tick(w,160,{jump:true});close(w.player.y,66);const jumps=w.drainEvents().filter(e=>e.type==='jump');assert.equal(jumps.length,1);});
test('释放后再次跳跃可以正常起跳',()=>{const w=quiet();tick(w,80,{jump:true});w.update(STEP);w.update(STEP,{jump:true});assert.ok(w.player.vy<0);});
test('趴下改变受击框，保持脚底和中心不变',()=>{const w=quiet();const x=w.player.cx,bottom=w.player.y+w.player.h;w.update(STEP,{down:true});assert.ok(w.player.prone);assert.equal(w.player.h,9);close(w.player.cx,x);close(w.player.y+w.player.h,bottom);w.update(STEP);assert.equal(w.player.h,30);close(w.player.cx,x);});
test('下加跳跃可以从上层穿到下层',()=>{const w=quiet();w.player.x=176;w.update(STEP);w.update(STEP,{down:true,jump:true});tick(w,70);close(w.player.y+w.player.h,128);assert.equal(w.deaths,0);});
test('上升时能穿过平台，下降时落在平台顶部',()=>{const w=quiet();w.player.x=176;w.player.y=98;w.player.grounded=true;tick(w,80,i=>({jump:i===0}));close(w.player.y+w.player.h,96);});
test('平台落地使用最先接触的高度，不穿透上层',()=>{const level={platforms:[{x:0,y:100,w:200,active:true},{x:0,y:110,w:200,active:true}],waterAt:()=>false};const p=new Player(20,60);p.vy=300;new CollisionSystem().move(p,.05,level);close(p.y+p.h,100);});
test('掉进河水进入水中姿势而非立即死亡',()=>{const w=quiet();w.player.x=260;w.player.y=165;w.player.grounded=false;tick(w,40);assert.ok(w.player.inWater);assert.equal(w.player.h,16);assert.equal(w.deaths,0);});
test('水中按下潜水，禁止移动和开火',()=>{const w=quiet();w.player.x=260;w.player.y=165;tick(w,40);const x=w.player.x;tick(w,30,{down:true,right:true,turbo:true});assert.ok(w.player.submerged);close(w.player.x,x);assert.equal(w.shots,0);});
test('水中可以跳回较低河岸',()=>{const w=quiet();w.player.x=590;w.player.y=165;tick(w,30);assert.ok(w.player.inWater);tick(w,75,i=>({right:true,jump:i===0}));assert.ok(w.player.y+w.player.h<=192);assert.equal(w.deaths,0);});
test('爆炸桥接近后坍塌，之后不能站在原桥面',()=>{const w=quiet();w.player.x=760;const bridge=w.level.platforms.find(p=>p.bridge);tick(w,70);assert.equal(bridge.active,false);assert.ok(w.drainEvents().some(e=>e.type==='explosion'));});
test('无水深坑会损失生命并触发复活',()=>{const w=quiet();w.player.x=1956;w.player.y=260;w.player.invincible=0;w.update(STEP);assert.equal(w.lives,2);assert.ok(w.player.respawnTimer>0);});

for(const [name,input,angle] of [['右',{right:true},0],['左',{left:true},Math.PI],['上',{up:true},-Math.PI/2],['右上',{right:true,up:true},-Math.PI/4],['左上',{left:true,up:true},-3*Math.PI/4],['右下',{right:true,down:true},Math.PI/4],['左下',{left:true,down:true},3*Math.PI/4]]) test(`八方向射击：${name}`,()=>{const w=quiet();w.update(STEP,{...input,fire:true});close(w.player.aim,angle);assert.equal(w.shots,1);});
test('跳跃时向正下方射击',()=>{const w=quiet();w.update(STEP,{jump:true});w.update(STEP,{down:true,fire:true});close(w.player.aim,Math.PI/2);assert.equal(w.bullets.length,1);assert.ok(w.bullets[0].vy>0);});
test('趴下射击保持水平方向',()=>{const w=quiet();w.update(STEP,{down:true,fire:true});close(w.player.aim,0);assert.equal(w.bullets[0].vy,0);});
test('普通枪长按只打一发，新按键边缘再次射击',()=>{const w=quiet();tick(w,60,{fire:true});assert.equal(w.shots,1);w.update(STEP);w.update(STEP,{fire:true});assert.equal(w.shots,2);});
test('普通枪屏幕弹数上限为四',()=>{const gun=new RifleWeapon();assert.equal(gun.tryFire(ctx({activeCount:4})).length,0);assert.equal(gun.tryFire(ctx({activeCount:3})).length,1);});
test('普通枪连续新按下不会被任意100毫秒冷却拦截',()=>{const gun=new RifleWeapon();assert.equal(gun.tryFire(ctx()).length,1);assert.equal(gun.tryFire(ctx({time:STEP})).length,1);});
test('H 连发手柄节流生效，不把每帧都变成开枪',()=>{const gun=new RifleWeapon();const frames=[];for(let i=0;i<60;i++)if(gun.tryFire(ctx({time:i*STEP,turbo:true})).length)frames.push(i);assert.equal(frames.length,10);assert.deepEqual(frames.slice(0,3),[0,6,12]);});
test('M 机枪按8帧间隔连发，第六发后停顿',()=>{const gun=new MachineWeapon(),frames=[];for(let i=0;i<64;i++)if(gun.tryFire(ctx({time:i*STEP,pressed:i===0})).length)frames.push(i);assert.deepEqual(frames.slice(0,7),[0,8,16,24,32,40,55]);});
test('M 机枪上限六发，槽位释放后能恢复射击',()=>{const gun=new MachineWeapon();assert.equal(gun.tryFire(ctx({activeCount:6})).length,0);assert.equal(gun.tryFire(ctx({time:STEP,activeCount:5})).length,1);});
test('S 单次五发、按原版顺序先中间再内外两对',()=>{const shots=new SpreadWeapon().tryFire(ctx());assert.equal(shots.length,5);assert.ok(shots.every(b=>b.kind==='spread'&&b.team==='player'));close(shots[1].vy,-shots[2].vy);close(shots[3].vy,-shots[4].vy);close(shots[0].vy,0);});
test('S 总上限十发，剩余槽位不足五个也能生成部分散弹',()=>{const gun=new SpreadWeapon();assert.equal(gun.tryFire(ctx({activeCount:8})).length,2);assert.equal(gun.tryFire(ctx({activeCount:10})).length,0);});
test('S 水平五发速度使用原版8.8表，R使用专用强化表',()=>{
  for(const[rapid,vectors]of [[false,[[765,0],[753,147],[753,-147],[708,291],[708,-291]]],[true,[[892,0],[878,171],[878,-171],[826,339],[826,-339]]]]){
    const shots=new SpreadWeapon().tryFire(ctx({rapid}));
    assert.deepEqual(shots.map(b=>[b.vx*256/60,b.vy*256/60]),vectors);
    for(const b of shots)b.update(32/60);
    assert.equal(new Set(shots.map(b=>Math.round(b.cy))).size,5,'five distinct visible lanes after 32 frames');
  }
});
test('S 八方向均以瞄准方向为中心，镜像和转90度保持五向结构',()=>{
  const shoot=angle=>new SpreadWeapon().tryFire(ctx({angle}));
  for(let octant=0;octant<8;octant++){
    const angle=octant*Math.PI/4,a=shoot(angle),opposite=shoot(angle+Math.PI),quarter=shoot(angle+Math.PI/2);
    for(let i=0;i<5;i++){close(a[i].vx,-opposite[i].vx);close(a[i].vy,-opposite[i].vy);close(quarter[i].vx,-a[i].vy);close(quarter[i].vy,a[i].vx);}
    close(Math.sin(a[0].angle-angle),0);
  }
});
test('S 槽位不足时优先中心弹，长按J不额外生成下一组',()=>{
  const gun=new SpreadWeapon(),shots=gun.tryFire(ctx({activeCount:9}));assert.equal(shots.length,1);close(shots[0].vy,0);
  assert.equal(gun.tryFire(ctx({time:1,pressed:false})).length,0);
  assert.equal(gun.tryFire(ctx({time:1,activeCount:0})).length,5);
});
test('R 提升普通子弹弹速，不改变点射判定',()=>{const normal=new RifleWeapon().tryFire(ctx())[0],rapid=new RifleWeapon().tryFire(ctx({rapid:true}))[0];close(normal.vx,180);close(rapid.vx,240);assert.equal(new RifleWeapon().tryFire(ctx({rapid:true,pressed:false})).length,0);});
test('F 火球按螺旋近似曲线飞行',()=>{const b=new FireWeapon().tryFire(ctx())[0];b.update(.1);assert.notEqual(b.cy,70);assert.ok(b.cx>30);});
test('L 生成四段，延迟对应1、4、7、10帧',()=>{const shots=new LaserWeapon().tryFire(ctx());assert.equal(shots.length,4);assert.deepEqual(shots.map(b=>Math.round(b.delay*60)),[1,4,7,10]);});
test('L 持续按住等待当前光束消失后再发',()=>{const gun=new LaserWeapon();assert.equal(gun.tryFire(ctx({pressed:false,activeCount:2})).length,0);assert.equal(gun.tryFire(ctx({pressed:false,activeCount:0})).length,4);});
test('L 重新按下会清除旧光束',()=>{const w=quiet();w.player.equip(new LaserWeapon());w.update(STEP,{fire:true});const old=w.bullets.slice();w.update(STEP);w.update(STEP,{fire:true});assert.ok(old.every(b=>!b.alive));assert.equal(w.bullets.length,4);});
test('击毁胶囊生成可拾取武器，而非自动装备',()=>{const w=quiet();const capsule=new Capsule(100,80,'S');capsule.takeDamage(1,w);assert.equal(w.pickups.length,1);assert.equal(w.pickups[0].code,'S');assert.equal(w.player.weapon.code,'N');});
for(const [code,Weapon] of [['M',MachineWeapon],['S',SpreadWeapon],['F',FireWeapon],['L',LaserWeapon],['N',RifleWeapon]]) test(`拾取 ${code} 替换当前武器，重复拾取不重复加分`,()=>{const w=quiet(),p=new Pickup(0,0,code);p.apply(w);p.apply(w);assert.ok(w.player.weapon instanceof Weapon);assert.equal(w.score,100);});
test('B 护罩持续1024帧，期间受击不损失生命',()=>{const w=quiet();new Pickup(0,0,'B').apply(w);close(w.player.invincible,1024/60);assert.equal(w.player.takeDamage(1,w),false);assert.equal(w.lives,3);});
test('敌人死亡只计分一次',()=>{const w=quiet(),e=new Enemy(0,0);e.takeDamage(1,w);e.takeDamage(1,w);assert.equal(w.kills,1);assert.equal(w.score,100);});
test('远处敌人不在屏幕外开枪',()=>{const w=quiet(),e=new Enemy(600,100,'turret');w.enemies=[e];tick(w,240);assert.equal(w.bullets.length,0);assert.equal(e.activated,false);});
test('屏幕内炮台延迟后发射三发弹幕',()=>{const w=quiet();w.enemies=[new Enemy(200,100,'turret')];tick(w,70);assert.equal(w.bullets.filter(b=>b.team==='enemy').length,3);});
test('固定枪手向玩家所在侧开火，转身不改变位置或射击周期',()=>{
  const w=quiet(),e=new Enemy(140,69,'rifleman');e.activated=true;
  for(const direction of [-1,1]){
    w.player.x=e.x+direction*60;e.nextShot=w.time;w.bullets=[];e.update(STEP,w);
    assert.equal(e.x,140);assert.equal(e.vx,0);assert.equal(e.facing,direction);
    assert.equal(w.bullets.length,1);assert.equal(Math.sign(w.bullets[0].vx),e.facing);close(e.nextShot-w.time,2.1);
    w.player.x=e.cx-w.player.w/2;e.update(STEP,w);assert.equal(e.facing,direction,'same center does not flip');
  }
});
test('高速子弹不会跨越细目标而漏判',()=>{const w=quiet();const e=new Enemy(110,74);w.enemies=[e];w.bullets=[new Bullet(80,85,0,'player',3000)];w.collision.updateBullets(w,.02);assert.equal(e.alive,false);});
test('同一直线多个目标只命中最先相交者',()=>{const w=quiet();const near=new Enemy(90,74),far=new Enemy(110,74);w.enemies=[far,near];w.bullets=[new Bullet(80,85,0,'player',3000)];w.collision.updateBullets(w,.02);assert.equal(near.alive,false);assert.equal(far.alive,true);});
test('玩家子弹不会伤害自己',()=>{const w=quiet();w.player.invincible=0;w.bullets=[new Bullet(w.player.cx,w.player.cy,0)];w.collision.updateBullets(w,STEP);assert.equal(w.lives,3);});
test('敌人子弹不会误伤敌人',()=>{const w=quiet();const e=new Enemy(150,74);w.enemies=[e];w.bullets=[new Bullet(e.cx,e.cy,0,'enemy')];w.collision.updateBullets(w,STEP);assert.equal(e.alive,true);});
test('趴下可以避开站立胸口高度的子弹',()=>{const w=quiet();w.player.invincible=0;w.update(STEP,{down:true});w.bullets=[new Bullet(w.player.x-20,85,0,'enemy',3000)];w.collision.updateBullets(w,STEP);assert.equal(w.lives,3);});
test('潜水可以避开敌方子弹',()=>{const w=quiet();w.player.invincible=0;w.player.submerged=true;w.bullets=[new Bullet(w.player.cx,w.player.cy,0,'enemy')];w.collision.updateBullets(w,STEP);assert.equal(w.lives,3);});
test('同帧多发命中只扣一条命',()=>{const w=quiet();w.player.invincible=0;for(let i=0;i<4;i++)w.bullets.push(new Bullet(w.player.cx,w.player.cy,0,'enemy'));w.collision.updateBullets(w,STEP);assert.equal(w.lives,2);assert.equal(w.deaths,1);});
test('死亡丢失武器及R，复活保留分数和当前卷轴',()=>{const w=quiet();w.camera=520;w.player.x=560;w.player.y=82;w.player.invincible=0;w.player.equip(new SpreadWeapon());w.player.rapid=true;w.score=1234;w.hurtPlayer();assert.equal(w.player.weapon.code,'N');assert.equal(w.player.rapid,false);tick(w,65);assert.equal(w.camera,520);assert.equal(w.score,1234);assert.ok(w.player.invincible>0);assert.ok(w.player.x>=w.camera);});
test('新生命无敌结束后可以再次受伤',()=>{const w=quiet();w.player.invincible=0;w.hurtPlayer();tick(w,65);assert.equal(w.player.takeDamage(1,w),false);tick(w,140);assert.equal(w.player.takeDamage(1,w),true);assert.equal(w.lives,1);});
test('三条命耗尽后停在GAME OVER',()=>{const w=quiet();for(let i=0;i<3;i++){w.player.invincible=0;w.player.respawnTimer=0;w.hurtPlayer();}assert.equal(w.lives,0);assert.equal(w.state,'gameover');const t=w.time;tick(w,60);assert.equal(w.time,t);});
test('加分奖励生命按20000、50000阈值触发一次',()=>{const w=quiet();w.addScore(19999);assert.equal(w.lives,3);w.addScore(1);assert.equal(w.lives,4);w.addScore(29999);assert.equal(w.lives,4);w.addScore(1);assert.equal(w.lives,5);});
test('B护罩触碰敌人可以消灭敌人',()=>{const w=quiet();new Pickup(0,0,'B').apply(w);const e=new Enemy(32,74,'rifleman');w.enemies=[e];w.update(STEP);assert.equal(e.alive,false);assert.equal(w.lives,3);});
test('同时接触敌人和武器时，死亡的角色不会拾取武器',()=>{const w=quiet();w.player.invincible=0;w.enemies=[new Enemy(32,74,'rifleman')];const pickup=new Pickup(32,74,'S');pickup.vy=0;w.pickups=[pickup];w.update(STEP);assert.equal(w.lives,2);assert.equal(w.player.weapon.code,'N');assert.equal(pickup.alive,true);});
test('Boss关底镜头可达，碉堡启动后发射子弹',()=>{const w=quiet();w.player.x=w.level.width-140;w.player.y=162;tick(w,100);assert.ok(w.boss.activated);assert.ok(w.bullets.some(b=>b.team==='enemy'));assert.equal(w.camera,w.level.width-C.WIDTH);});
test('碉堡炮台可单独击毁，不直接通关',()=>{const w=quiet();w.boss.parts[0].takeDamage(100,w);assert.ok(w.boss.alive);assert.equal(w.state,'playing');});
test('核心被毁后延迟进入通关，期间不会被敌人杀死',()=>{const w=quiet();w.player.invincible=0;w.boss.parts.find(p=>p.kind==='core').takeDamage(100,w);assert.equal(w.boss.alive,false);assert.ok(w.clearTimer>0);assert.equal(w.hurtPlayer(),false);tick(w,120);assert.equal(w.state,'won');assert.equal(w.lives,3);assert.equal(w.score,5000);});
test('物理时钟在30/60/120/144 Hz显示下执行相同步数',()=>{for(const fps of [30,60,120,144]){const c=new FixedClock();let n=0;for(let i=0;i<fps*10;i++)c.advance(1/fps,()=>n++);assert.equal(n,600);}});
test('长帧最多补六步，切回页面不会瞬移',()=>{const c=new FixedClock();let n=0;c.advance(60,()=>n++);assert.equal(n,6);});
test('暂停恢复时能清空残余物理时间',()=>{const c=new FixedClock();c.advance(STEP/2,()=>{});c.reset();let n=0;c.advance(STEP/2,()=>n++);assert.equal(n,0);});
test('离屏和超时子弹被移除',()=>{const w=quiet();w.bullets=[new Bullet(-30,40,Math.PI),new Bullet(400,40,0)];tick(w,2);assert.equal(w.bullets.length,0);});
test('事件队列与视觉事件不会无限堆积',()=>{const w=quiet();for(let i=0;i<1000;i++)w.emit('shot',{});assert.equal(w.events.length,256);assert.equal(w.drainEvents().length,256);assert.equal(w.events.length,0);});
test('同样种子和输入产生一致状态',()=>{const run=()=>{const w=fresh();for(let i=0;i<2400;i++){if(w.state==='gameover')w.reset();w.update(STEP,{right:true,turbo:true,jump:i%53===0});}return JSON.stringify({x:w.player.x,y:w.player.y,score:w.score,lives:w.lives,enemies:w.enemies.map(e=>[e.x,e.y]),seed:w.random.seed});};assert.equal(run(),run());});
test('所有卷轴复活点均位于当前屏幕内且可继续行动',()=>{for(let camera=0;camera<=new C.Level().width-C.WIDTH;camera+=16){const w=quiet();w.camera=camera;w.respawn();tick(w,60);assert.ok(Number.isFinite(w.player.y));assert.ok(w.player.x>=camera,`camera=${camera}, x=${w.player.x}`);assert.ok(w.player.x<camera+256);assert.equal(w.deaths,0,`复活点掉落: ${camera}`);}});
test('随机输入压力：120轮 × 6000帧，状态有限、实体数量有界',()=>{
  let total=0,maxBullets=0,maxEnemies=0;
  for(let seed=1;seed<=120;seed++){
    const w=new GameWorld(seed),r=new Random(seed*729);w.reset();let input={};
    for(let i=0;i<6000;i++){
      if(w.state==='gameover'||w.state==='won')w.reset();
      if(i%9===0)input={right:r.next()<.8,left:r.next()<.13,jump:r.next()<.35,down:r.next()<.1,up:r.next()<.1,fire:r.next()<.45,turbo:r.next()<.65};
      w.update(STEP,input);w.drainEvents();total++;
      for(const number of [w.player.x,w.player.y,w.player.vx,w.player.vy,w.camera,w.time,w.score])assert.ok(Number.isFinite(number));
      assert.ok(w.lives>=0);assert.ok(w.player.x>=w.camera-.001);maxBullets=Math.max(maxBullets,w.bullets.length);maxEnemies=Math.max(maxEnemies,w.enemies.length);
      assert.ok(w.bullets.length<150);assert.ok(w.enemies.length<60);
    }
  }
  console.log(JSON.stringify({stressFrames:total,maxBullets,maxEnemies}));
});

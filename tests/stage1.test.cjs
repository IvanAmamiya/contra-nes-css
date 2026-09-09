'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const C=require('../core.js'),stage=require('../assets/stage1.json'),source=require('../assets/stage1-source.json'),{decode,decompress}=require('../tools/build-stage1.cjs'),Pilot=require('./pilot.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('源表13屏各展开56块，异常RLE拒绝构建',()=>{assert.equal(source.screens.length,13);for(const bytes of source.screens)assert.equal(decompress(bytes).length,56);assert.throws(()=>decompress([0x88]));assert.throws(()=>decompress([0]));assert.throws(()=>decompress([0xff]));assert.deepEqual(decode(source).platforms,stage.platforms);});
test('原版关键地形：起点96高、两座128宽断桥、末端192高',()=>{const level=new C.Level();assert.equal(level.width,3328);assert.deepEqual(level.platforms.filter(p=>p.bridge).map(p=>[p.x,p.y,p.w]),[768,800,832,864,1056,1088,1120,1152].map(x=>[x,96,32]));assert.ok(level.platforms.some(p=>p.x===32&&p.y===96&&p.w===736));assert.ok(level.platforms.some(p=>p.x===3008&&p.y===192&&p.w===240));assert.equal(level.waterSurface(500),192);assert.equal(level.waterAt(2400),false);});
test('30个对象包括重复胶囊，按卷轴偏移加240解码',()=>{assert.equal(stage.objects.length,30);assert.deepEqual(stage.objects[0],{screen:0,rawX:16,type:5,attributes:0,spawnCamera:16,cx:256,cy:80});const twins=stage.objects.filter(o=>o.screen===9&&o.type===3);assert.deepEqual(twins.map(o=>[o.cx,o.cy,o.attributes]),[[2560,48,0],[2560,160,4]]);const level=new C.Level();assert.equal(level.createEnemies().length,18);assert.deepEqual(level.createCapsules().map(c=>c.code),['M','R','S','F','S','R','L']);assert.equal(level.createBossParts().length,3);});
test('飞行胶囊从左侧16像素进入，向右每秒90像素且绕原始高度摆动',()=>{const w=new C.GameWorld();w.reset();const c=w.capsules.find(c=>c.flying);assert.equal(c.cx,c.spawnCamera+16);assert.equal(c.cy,c.source.cy+32);w.camera=c.spawnCamera;const x=c.x,y=c.y;for(let i=0;i<60;i++)c.update(C.STEP,w);assert.ok(Math.abs(c.x-x-90)<1e-8);assert.notEqual(c.y,y);assert.ok(c.alive);for(let i=0;i<180;i++)c.update(C.STEP,w);assert.equal(c.alive,false);});
test('原始首个士兵在卷轴16才活动，提前射击不能命中隐藏对象',()=>{const w=new C.GameWorld();w.reset();const e=w.enemies[0],x=e.x;w.camera=15;e.update(C.STEP,w);assert.equal(e.activated,false);assert.equal(e.x,x);w.bullets=[new C.Bullet(e.cx,e.cy,0)];w.collision.updateBullets(w,C.STEP);assert.equal(e.hp,1);w.camera=16;e.update(C.STEP,w);assert.ok(e.activated);assert.ok(e.x<x);});
test('只用按键的原版路线包含拾取、两座断桥与关底通关',()=>{const w=new C.GameWorld(1337);w.reset('playing',30);const pilot=new Pilot();let pickups=0,frames=0;while(w.state==='playing'&&frames++<18000){w.update(C.STEP,pilot.next(w));for(const e of w.drainEvents())if(e.type==='pickup')pickups++;}assert.equal(w.state,'won');assert.ok(pickups>0);assert.ok(w.level.platforms.filter(p=>p.bridge).every(p=>!p.active));assert.equal(w.camera,3072);});
test('出生点覆盖13屏所有卷轴，停留后不会落入深坑',()=>{for(let camera=0;camera<=3072;camera+=8){const w=new C.GameWorld();w.reset();w.enemies=[];w.capsules=[];w.nextSpawn=Infinity;w.camera=camera;w.respawn();for(let i=0;i<90;i++)w.update(C.STEP);assert.equal(w.deaths,0,'camera '+camera);assert.ok(w.player.x>=camera&&w.player.x<camera+256);}});
test('全部728个场景块对应原始地图裁剪，61种CSS块逐像素无损',()=>{
  const bg=require('../assets/backgrounds.json'),map=bg.maps['stage-1'],css=fs.readFileSync(path.join(__dirname,'../assets/stage1.css'),'utf8');
  const decoded=new Map();for(const m of css.matchAll(/\.stage-chunk-(\d+)\{background:([^}]+)\}/g)){
    const pixels=Buffer.alloc(4096),rows=[...m[2].matchAll(/linear-gradient\(90deg,([^)]*)\) 0px (\d+)px\/32px 2px no-repeat/g)];assert.equal(rows.length,32);
    for(const row of rows.reverse())for(const run of row[1].matchAll(/#([a-f0-9]{8}) (\d+)px (\d+)px/g))for(let y=+row[2];y<Math.min(32,+row[2]+2);y++)for(let x=+run[2];x<+run[3];x++)Buffer.from(run[1],'hex').copy(pixels,(y*32+x)*4);
    assert.equal(hash(pixels),stage.art.hashes[+m[1]]);decoded.set(+m[1],pixels);
  }
  assert.equal(decoded.size,61);assert.equal(stage.art.chunks.length,728);
  for(let cy=0;cy<7;cy++)for(let cx=0;cx<104;cx++){
    const pixels=decoded.get(stage.art.chunks[cy*104+cx]);for(let ty=0;ty<4;ty++)for(let tx=0;tx<4;tx++){
      const tile=Buffer.alloc(256);for(let y=0;y<8;y++)pixels.copy(tile,y*32,((ty*8+y)*32+tx*8)*4,((ty*8+y)*32+tx*8+8)*4);
      const id=map.tiles[(2+cy*4+ty)*map.cols+64+cx*4+tx];assert.equal(hash(tile),bg.tiles[id].visibleRgbaSha256,`chunk ${cx},${cy} tile ${tx},${ty}`);
    }
  }
});

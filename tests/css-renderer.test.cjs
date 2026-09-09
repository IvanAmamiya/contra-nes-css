'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Core=require('../core.js');
function boot(expanded=false){
  let observer;class Element{constructor(){this.children=[];this.style={};this.dataset={};this.hidden=false;this.className='';this.classList={add:c=>this.className+=' '+c,toggle:(c,on)=>{const s=new Set(this.className.split(' '));on?s.add(c):s.delete(c);this.className=[...s].join(' ');}};}appendChild(e){this.children.push(e);e.parent=this;}replaceChildren(...es){this.children=es;for(const e of es)e.parent=this;}setAttribute(){}getBoundingClientRect(){return{width:768,height:672};}remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}}
  const window={ContraCore:Core,ContraAssets:require('../assets/manifest.json'),ContraBackgrounds:require('../assets/backgrounds.json')},document={createElement:()=>new Element()};
  if(expanded){window.SpiritsArt=require('../assets/spirits-art.json');window.ContraSpirits=require('../spirits-core.js');}
  const ResizeObserver=class{constructor(fn){observer=this;this.fn=fn;}observe(){}disconnect(){this.disconnected=true;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../css-renderer.js'),'utf8'),{window,document,ResizeObserver,Promise,Math});
  const viewport=new Element(),renderer=new window.ContraRenderer(viewport),world=new Core.GameWorld();
  const count=e=>1+e.children.reduce((n,c)=>n+count(c),0);return{renderer,world,viewport,count,observer};
}
test('标题切换到CSS关卡后，重置能释放旧地形DOM',()=>{const{renderer:r,world:w,count}=boot();r.draw(w,0);assert.equal(r.land.hidden,true);w.reset('playing');r.draw(w,0);const n=count(r.land);assert.ok(n>100&&n<600);const before=r.land.children[0];w.reset('playing');r.draw(w,0);assert.equal(count(r.land),n);assert.notEqual(r.land.children[0],before);});
test('2000次重复渲染复用节点，暂停不推进动作与效果',()=>{const{renderer:r,world:w,count}=boot();w.reset('playing');r.draw(w,0);const n=count(r.stage);for(let i=0;i<2000;i++)r.draw(w,1/60);assert.equal(count(r.stage),n);r.event({type:'explosion',x:50,y:50});w.state='paused';const t=r.time;r.draw(w,1);assert.equal(r.time,t);assert.equal(r.effects[0].age,0);});
test('趴下、潜水、斜上射击均引用原版精灵',()=>{const{renderer:r,world:w}=boot();w.reset('playing');w.player.invincible=0;w.player.prone=true;w.player.grounded=true;r.draw(w,0);assert.ok(r.pool.some(e=>e.className.includes('sprite_17')));w.player.inWater=true;w.player.submerged=true;r.draw(w,0);assert.ok(r.pool.some(e=>!e.hidden&&e.className.includes('sprite_19')));w.player.submerged=false;w.player.aim=-Math.PI/4;r.draw(w,0);assert.ok(r.pool.some(e=>!e.hidden&&e.className.includes('sprite_1c')));});
test('断桥显示空洞，已击毁炮台和碉堡部件停止显示',()=>{const{renderer:r,world:w}=boot();w.reset('playing');r.draw(w,0);r.bridges[0][0].active=false;r.fixed[0][0].alive=false;r.bossFaces[0][0].alive=false;r.draw(w,0);assert.equal(r.bridges[0][1].hidden,false);assert.equal(r.fixed[0][1].hidden,true);assert.ok(r.bossFaces[0][1].className.includes('destroyed'));});
test('渲染器销毁时释放观察器与场景',()=>{const{renderer:r,viewport,observer}=boot();r.destroy();assert.equal(viewport.children.length,0);assert.equal(observer.disconnected,true);});
test('三关新Boss、平台、攀附姿势与标题切换；重复重建保持节点有界',()=>{const{renderer:r,count}=boot(true),S=require('../spirits-core.js');for(let i=0;i<60;i++){const w=new S.SpiritsWorld(S.STAGES[i%3].id);w.reset();w.camera=1024;w.boss.activated=true;w.player.invincible=0;w.player.clinging={type:'ceiling'};r.draw(w,0);assert.ok(r.pool.some(e=>!e.hidden&&e.className==='nes-art art-sprite_16'));assert.ok(r.pool.some(e=>!e.hidden&&e.className.includes('art-spirits_')));assert.ok(r.chunks.some(c=>c.className.includes('spirits-chunk-'+w.level.id)));assert.equal(r.bossMeter.hidden,false);assert.ok(count(r.stage)<180);w.state='title';r.draw(w,0);assert.equal(r.bossMeter.hidden,true);assert.equal(r.bombLayer.hidden,true);}});

test('B保护视觉持续可见；炸弹用独立ROM图标；消失道具不残留',()=>{const{renderer:r}=boot(true),S=require('../spirits-core.js'),w=new S.SpiritsWorld();w.reset();w.player.grantBarrier();r.time=1/16;r.draw(w,0);assert.equal(r.barrierLayer.hidden,false);assert.ok(r.pool.some(e=>!e.hidden&&/art-sprite_0f$/.test(e.className)));assert.ok(r.pool.some(e=>!e.hidden&&e.className==='nes-art art-spirits_bomb'));const p=w.pickups.find(p=>p.code==='bomb');p.alive=false;r.draw(w,0);assert.equal(r.pool.filter(e=>!e.hidden&&e.className==='nes-art art-spirits_bomb').length,0);w.player.barrier=0;r.draw(w,0);assert.equal(r.barrierLayer.hidden,true);});

test('真实S枪生成的五颗弹在第16、32帧切换原版三段大小',()=>{
  const{renderer:r,world:w}=boot();w.reset('playing');w.enemies=[];w.capsules=[];
  w.bullets=new Core.SpreadWeapon().tryFire({time:0,x:80,y:100,angle:0});
  for(let frame=0;frame<=33;frame++){
    if(frame)for(const b of w.bullets)b.update(Core.STEP);
    if(![0,15,16,31,32,33].includes(frame))continue;
    r.draw(w,0);const id=frame<16?'1f':frame<32?'20':'21';
    assert.equal(r.pool.filter(e=>!e.hidden&&e.className===`nes-art art-sprite_${id}`).length,5,`frame ${frame}`);
    assert.equal(r.pool.filter(e=>!e.hidden&&e.className==='nes-art art-sprite_1e').length,0,'S must not fall back to normal bullets');
  }
});

test('M弹、普通敌弹和碉堡炮弹使用各自素材，不混成大散弹',()=>{
  const{renderer:r,world:w}=boot();w.reset('playing');w.enemies=[];w.capsules=[];
  const m=new Core.MachineWeapon().tryFire({time:0,x:80,y:80,angle:0,held:true,pressed:true,activeCount:0});
  assert.equal(m.length,1);assert.equal(m[0].kind,'machine');
  w.bullets=[...m,new Core.Bullet(90,90,0,'enemy'),new Core.Bullet(100,100,0,'enemy',80,'cannon')];r.draw(w,0);
  assert.deepEqual(Array.from(r.pool).filter(e=>!e.hidden&&/sprite_(1f|1e|21)$/.test(e.className)).map(e=>e.className),['nes-art art-sprite_1f','nes-art art-sprite_1e','nes-art art-sprite_21']);
});

test('跑兵左右移动时六帧原图朝向一致，卷轴不会把身体反转',()=>{
  const{renderer:r,world:w}=boot();w.reset('playing');
  for(const direction of [-1,1]){
    const e=new Core.Enemy(140,69,'runner',direction),x=e.x;e.update(Core.STEP,w);
    assert.equal(Math.sign(e.x-x),direction);
    for(let frame=0;frame<6;frame++)for(const camera of [0,64]){
      r.used=0;r.time=(frame*8+1)/60;r.human(e,camera);
      // Verified source PNGs face left, so only rightward soldiers are mirrored.
      const transform=r.pool[0].style.transform;
      assert.ok(transform.endsWith(`scale(${-direction},1)`),`direction=${direction}, frame=${frame}, camera=${camera}: ${transform}`);
      const width=require('../assets/manifest.json').assets[r.pool[0].className.split('art-')[1]].width;
      const translate=Number(transform.match(/translate\((-?\d+)px/)[1]);
      assert.ok(Math.abs(translate+(direction===1?-width/2:width/2)-(e.cx-camera))<=.5,'mirror preserves screen center');
    }
  }
});

test('枪手转向与原图镜像一致，玩家左右朝向保持正确',()=>{
  const{renderer:r,world:w}=boot();w.reset('playing');w.player.invincible=0;
  const e=new Core.Enemy(140,69,'rifleman');
  for(const direction of [-1,1]){
    w.player.x=e.x+direction*60;e.update(Core.STEP,w);r.used=0;r.human(e,0);
    assert.equal(e.facing,direction);assert.ok(r.pool[0].style.transform.endsWith(`scale(${-direction},1)`));
    w.player.facing=direction;w.player.aim=direction===1?0:Math.PI;r.used=0;r.human(w.player,0,true);
    assert.ok(r.pool[0].style.transform.endsWith(`scale(${direction},1)`));
  }
});

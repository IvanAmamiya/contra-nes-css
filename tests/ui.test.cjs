'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Core=require('../core.js');
// 在独立 DOM 替身中执行真实 app.js，专门覆盖输入时序与生命周期。
function boot(){
  const elements=new Map(),docEvents={},winEvents={};let frame,now=0,world;
  class Element{
    constructor(id){this.id=id;this.tagName=id==='game'?'DIV':'BUTTON';this.textContent='';this.hidden=false;this.disabled=false;this.dataset={};this.attributes={};this.events={};const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};}
    addEventListener(name,fn){this.events[name]=fn;}setAttribute(name,value){this.attributes[name]=value;}focus(){}setPointerCapture(){}
    dispatch(type,props={}){this.events[type]?.({target:this,preventDefault(){},...props});}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
  const buttons=['left','right','up','down','jump','fire','turbo'].map(name=>{const el=get(name);el.dataset.control=name;return el;});
  const document={hidden:false,getElementById:get,querySelectorAll:()=>buttons,addEventListener:(name,fn)=>docEvents[name]=fn};
  const window={ContraCore:{...Core,GameWorld:class extends Core.GameWorld{constructor(){super();world=this;}}},ContraRenderer:class{event(){}clear(){}draw(){}},addEventListener:(name,fn)=>winEvents[name]=fn};
  const sandbox={window,document,requestAnimationFrame:fn=>frame=fn,console,Set,Map,Math};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),sandbox);
  const key=(code,type='keydown',extra={})=>docEvents[type]({code,repeat:false,target:get('game'),preventDefault(){},...extra});
  const advance=(frames=1)=>{for(let i=0;i<frames;i++){now+=1000/60;frame(now);}};
  const start=()=>{get('start-button').dispatch('click');advance(2);};
  return{get,key,advance,start,document,docEvents,winEvents,get world(){return world;}};
}
test('真实启动按钮进入游戏，隐藏菜单',()=>{const a=boot();a.start();assert.equal(a.world.state,'playing');assert.equal(a.get('menu').hidden,true);});
test('快速点按J，即使按下抬起发生在两帧之间也不会漏射',()=>{const a=boot();a.start();a.key('KeyJ');a.key('KeyJ','keyup');a.advance();assert.equal(a.world.shots,1);a.advance(10);assert.equal(a.world.shots,1);});
test('快速点按跳跃不会因帧间释放而漏输入',()=>{const a=boot();a.start();a.key('KeyK');a.key('KeyK','keyup');a.advance();assert.ok(a.world.player.vy<0);});
test('长按方向键移动，松开后停止',()=>{const a=boot();a.start();const x=a.world.player.x;a.key('KeyD');a.advance(20);assert.equal(a.world.player.x,x+20);a.key('KeyD','keyup');a.advance(20);assert.equal(a.world.player.x,x+20);});
test('P暂停，恢复后旧方向键不会卡住',()=>{const a=boot();a.start();a.key('KeyD');a.advance(10);a.key('KeyP');const x=a.world.player.x,t=a.world.time;a.advance(60);assert.equal(a.world.time,t);a.key('KeyP');a.advance(5);assert.equal(a.world.player.x,x);});
test('Enter键可开始、暂停与恢复',()=>{const a=boot();a.key('Enter');a.advance(2);assert.equal(a.world.state,'playing');a.key('Enter');assert.equal(a.world.state,'paused');a.key('Enter');assert.equal(a.world.state,'playing');});
test('窗口失焦会暂停并清除输入',()=>{const a=boot();a.start();a.key('KeyD');a.advance();a.winEvents.blur();assert.equal(a.world.state,'paused');a.key('KeyP');const x=a.world.player.x;a.advance(10);assert.equal(a.world.player.x,x);});
test('页面隐藏会暂停，重新可见后等待玩家手动恢复',()=>{const a=boot();a.start();a.document.hidden=true;a.docEvents.visibilitychange();assert.equal(a.world.state,'paused');a.document.hidden=false;a.docEvents.visibilitychange();assert.equal(a.world.state,'paused');});
test('暂停时R重开，分数、生命和武器一并重置',()=>{const a=boot();a.start();a.world.score=900;a.world.lives=1;a.key('KeyP');a.key('KeyR');assert.equal(a.world.state,'playing');assert.equal(a.world.score,0);assert.equal(a.world.lives,3);});
test('触屏支持同时移动和跳跃，取消指针后不会卡键',()=>{const a=boot();a.start();a.get('right').dispatch('pointerdown',{pointerId:1});a.get('jump').dispatch('pointerdown',{pointerId:2});a.advance(10);assert.ok(a.world.player.x>32);assert.ok(a.world.player.y<74);a.get('right').dispatch('pointercancel',{pointerId:1});a.get('jump').dispatch('pointerup',{pointerId:2});const x=a.world.player.x;a.advance(10);assert.equal(a.world.player.x,x);assert.equal(a.get('right').classList.contains('active'),false);});
test('丢失指针捕获会释放触屏射击',()=>{const a=boot();a.start();a.get('turbo').dispatch('pointerdown',{pointerId:1});a.advance(15);const shots=a.world.shots;assert.ok(shots>1);a.get('turbo').dispatch('lostpointercapture',{pointerId:1});a.advance(15);assert.equal(a.world.shots,shots);});
test('触屏一帧之间的点射仍能触发子弹',()=>{const a=boot();a.start();a.get('fire').dispatch('pointerdown',{pointerId:1});a.get('fire').dispatch('pointerup',{pointerId:1});a.advance();assert.equal(a.world.shots,1);});
test('声音开关更新可访问状态，M可切换回来',()=>{const a=boot();a.get('sound-button').dispatch('click');assert.equal(a.get('sound-button').attributes['aria-pressed'],'true');a.key('KeyM');assert.equal(a.get('sound-button').attributes['aria-pressed'],'false');});
test('标题画面Konami代码开启30命，不影响默认模式',()=>{const a=boot();for(const code of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'])a.key(code);a.start();assert.equal(a.world.lives,30);const b=boot();b.start();assert.equal(b.world.lives,3);});
test('浏览器快捷键不被游戏当成输入',()=>{const a=boot();a.start();a.key('KeyD','keydown',{ctrlKey:true});a.advance(10);assert.equal(a.world.player.x,32);});


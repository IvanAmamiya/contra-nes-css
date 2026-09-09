(function () {
  'use strict';
  const { WIDTH, HEIGHT } = window.ContraCore;
  const assets = window.ContraAssets.assets, bg = window.ContraBackgrounds;
  Object.assign(assets,window.SpiritsArt?.assets||{});
  Object.assign(assets,window.SpiritsActors?.assets||{});
  assets.spirits_bomb={width:16,height:16};
  const px = n => `${Math.round(n)}px`;
  function element(className, parent) { const el = document.createElement('div'); el.className = className; if (parent) parent.appendChild(el); return el; }
  function move(el, x, y, suffix = '') { const value = `translate(${px(x)},${px(y)})${suffix}`; if (el.style.transform !== value) el.style.transform = value; }
  // Native pixels use CSS hard-stop gradients (game) / shadows (tile inspector).
  class CssTiles {
    static patch(name, width, height) {
      const p = typeof name === 'string' ? bg.patches[name] : name;
      const map = bg.maps[p.map], w = width ?? p.w, h = height ?? p.h;
      const container = element('nes-patch'); container.style.width = px(w); container.style.height = px(h);
      if(typeof name==='string'){
        for(let y=0;y<h;y+=p.h)for(let x=0;x<w;x+=p.w){const patch=element(`nes-art patch-${name}`,container);move(patch,x,y);}
        return container;
      }
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) {
        const tx = Math.floor((p.x + x % p.w) / 8), ty = Math.floor((p.y + y % p.h) / 8);
        const id = map.tiles[ty * map.cols + tx];
        const tile = element(`nes-art nes-tile bg-${id}`, container); move(tile, x, y);
      }
      return container;
    }
    static region(mapId, x, y, width, height) { return this.patch({map:mapId,x,y,w:width,h:height}); }
  }
  class Renderer {
    constructor(viewport) {
      this.viewport = viewport; this.stage = element('css-stage', viewport);
      this.stage.setAttribute('aria-hidden','true');
      this.background = element('css-background', this.stage);

      this.land = element('css-land', this.stage); this.actors = element('css-actors', this.stage);
      this.hud = element('css-hud', this.stage); this.overlay = element('css-overlay', this.stage);
      this.titleLayer = element('css-title', this.stage);
      const logo=CssTiles.patch('logo');logo.classList.add('contra-logo');this.titleLayer.appendChild(logo);move(logo,32,30);
      const heroes=CssTiles.patch('heroes');this.titleLayer.appendChild(heroes);move(heroes,150,126);
      const caption=element('title-caption',this.titleLayer);caption.textContent='FIRST STAGE';
      if(window.ContraSpirits)caption.textContent='CONTRA SPIRITS / FC EDITION';
      this.bossMeter=element('spirits-boss-meter',this.stage);this.bossMeter.hidden=true;
      this.bombLayer=element('spirits-bomb-flash',this.stage);this.bombLayer.hidden=true;
      this.barrierLayer=element('spirits-barrier',this.actors);this.barrierLayer.hidden=true;
      this.pool = []; this.time=0; this.effects=[]; this.level=null; this.bridges=[];
      this.ready = Promise.resolve(true);
      this.resize = () => { const r=viewport.getBoundingClientRect(); this.stage.style.transform=`scale(${r.width/WIDTH},${r.height/HEIGHT})`; };
      this.resize(); this.observer = new ResizeObserver(this.resize); this.observer.observe(viewport);
    }
    buildLevel(world) {
      this.land.replaceChildren();this.level=world.level;this.chunkColumn=-1;
      this.background.replaceChildren();
      if(world.level.data.rom)for(let y=0;y<7;y++)for(let x=0;x<8;x++){const el=element('stage-chunk rom-city-'+world.level.data.sky[y*8+x],this.background);move(el,x*32,y*32);}
      this.chunks=Array.from({length:70},()=>element('stage-chunk',this.land));
      this.bridges=world.level.platforms.filter(p=>p.bridge).map(p=>{const el=element('css-bridge-gap',this.land);move(el,p.x,p.y);return[p,el];});
      this.fixed=[];
      for(const object of [...world.enemies.filter(e=>e.kind==='turret'),...world.capsules.filter(c=>!c.flying)]){
        const visual=CssTiles.patch(object.kind==='turret'?object.visual:'crate');this.land.appendChild(visual);move(visual,object.cx-16,object.cy-16);this.fixed.push([object,visual]);
      }
      this.bossFaces=[];
      if(world.level.data.spirits&&!world.level.data.rom){
        for(const p of world.level.platforms){const el=element(`spirits-platform ${world.level.id}`,this.land);move(el,p.x,p.y);el.style.width=px(p.w);el.style.height=px(p.h);}
        for(const g of world.level.grips){const el=element('spirits-grip '+g.type,this.land);move(el,g.x,g.y);el.style.width=px(g.w);el.style.height=px(g.h);}
      }else if(!world.level.data.spirits)for(const part of world.boss.parts){const holder=element('css-boss-part',this.land);move(holder,part.x,part.y);holder.style.width=px(part.w);holder.style.height=px(part.h);this.bossFaces.push([part,holder]);}
    }
    drawMap(cam) {
      const art=this.level.data.art,column=Math.floor(cam/32);
      if(column!==this.chunkColumn||this.mapRevision!==this.level.artRevision){this.chunkColumn=column;this.mapRevision=this.level.artRevision;for(let y=0;y<7;y++)for(let x=0;x<10;x++){
        const el=this.chunks[y*10+x],col=column+x;el.hidden=col>=art.cols;if(el.hidden)continue;
        const drawCol=this.level.removedWalls?.some(w=>col*32>=w&&col*32<w+96)?col%8:col;
        el.className='stage-chunk '+(art.prefix||'stage-chunk-')+art.chunks[y*art.cols+drawCol];move(el,col*32,y*32);
      }}
    }
    sprite(id,x,y,face=1,flipY=false) {
      const a=assets[id];if(!a)return;
      let el=this.pool[this.used];if(!el){el=element('',this.actors);this.pool.push(el);}this.used++;
      const cls=`nes-art art-${id}`;if(el.className!==cls)el.className=cls;
      el.hidden=false;el.style.filter='';el.style.transformOrigin='';move(el,x+(face<0?a.width:0),y+(flipY?a.height:0),` scale(${face},${flipY?-1:1})`);return el;
    }
    human(actor,cam,player=false) {
      if(actor.renderInMap)return;
      if(player&&(actor.respawnTimer>0||!actor.alive||actor.invincible>0&&!(actor.slots&&actor.barrier>0)&&Math.floor(this.time*16)%2))return;
      if(actor.rom&&!player&&window.SpiritsActors){
        const anim=window.SpiritsActors.animations;let id,face=actor.facing;
        if(actor.kind==='car'){id='c3_car';face=1;}
        else if(actor.kind==='sentry'){id='c3_turret';face=-face;}
        else if(actor.kind==='dog'){id='c3_dog';face=-face;}
        else if(actor.nativeArt){id=actor.nativeArt;face=1;}
        else{id=anim.runner[Math.floor(actor.poseFrame/6)%anim.runner.length];}
        const a=assets[id];if(a)this.sprite(id,Math.floor(actor.cx)-cam-(face<0?a.width-(a.anchorX??a.width/2):(a.anchorX??a.width/2)),Math.floor(actor.y+actor.h)-(a.anchorY??a.height),face);return;
      }
      const frame=Math.floor(this.time*60/8)%6;let id, flip=false;
      if(!player)id=actor.kind==='rifleman'?'43':['3b','3c','3d','3f','3c','3e'][frame];
      else if(actor.submerged)id='19';
      else if(actor.inWater)id=Math.abs(Math.cos(actor.aim))<.05?'1b':Math.sin(actor.aim)<-.1?'1c':'1d';
      else if(actor.prone)id='17';
      else if(actor.clinging)id='16';
      else if(actor.spinning||!actor.grounded){const r=Math.floor(this.time*12)%4;id=r%2?'09':'08';flip=r>=2;}
      else if(Math.abs(Math.cos(actor.aim))<.05)id='16';
      else if(Math.sin(actor.aim)<-.1)id=['10','11','12'][frame%3];
      else if(Math.sin(actor.aim)>.1)id=['13','14','15'][frame%3];
      else id=Math.abs(actor.vx)>0?['0d','0e','0f'][frame%3]:'0f';
      id=`sprite_${id}`;const a=assets[id];const bottom=actor.y+actor.h;
      // The exported player poses face right; soldier/sniper poses face left.
      const mirror=player?actor.facing:-actor.facing;
      this.sprite(id,actor.cx-cam-a.width/2,bottom-a.height,mirror,flip);
    }
    event(e) {
      if(e.type==='death')this.effects.push({...e,age:0,duration:.9});
      if(e.type==='explosion')this.effects.push({...e,age:0,duration:e.big?.6:.35});
      if(e.type==='hit')this.effects.push({...e,age:0,duration:.1});
      if(this.effects.length>48)this.effects.splice(0,this.effects.length-48);
    }
    clear(){this.effects=[];this.time=0;}
    draw(world,dt) {
      if(world.state==='playing'||world.state==='title')this.time+=dt;
      const title=world.state==='title';this.titleLayer.hidden=!title;
      this.background.hidden=title;this.land.hidden=title;this.actors.hidden=title;this.hud.hidden=title;
      this.overlay.hidden=true;if(title){this.bossMeter.hidden=true;this.bombLayer.hidden=true;return;}
      if(this.level!==world.level)this.buildLevel(world);
      const cam=Math.floor(world.camera);move(this.land,-cam,0);
      this.drawMap(cam);
      for(const[p,el]of this.bridges)el.hidden=p.active;
      for(const[p,el]of this.fixed)el.hidden=!p.alive||p.spawnCamera>world.camera;
      for(const[p,el]of this.bossFaces){el.classList.toggle('destroyed',!p.alive);el.classList.toggle('hit',p.flash>0);}
      this.used=0;
      for(const capsule of world.capsules){if(!capsule.alive||!capsule.flying||capsule.spawnCamera>world.camera||capsule.x-cam>WIDTH+24||capsule.x-cam<-32)continue;const id=capsule.rom?'c3_capsule':'sprite_4d',a=assets[id];this.sprite(id,capsule.cx-cam-a.width/2,capsule.cy-a.height/2);}
      const pickupId={S:'2f',B:'30',F:'31',L:'32',R:'33',M:'34'};
      for(const p of world.pickups){if(!p.alive)continue;const id=world.level.data.spirits&&assets['spirits_'+p.code]?'spirits_'+p.code:`sprite_${pickupId[p.code]||'34'}`,a=assets[id];this.sprite(id,p.cx-cam-a.width/2,p.y+p.h-a.height);}
      for(const e of world.enemies){if(e.kind==='turret'||e.spawnCamera>world.camera||e.x-cam<-40||e.x-cam>WIDTH+24)continue;this.human(e,cam);}
      if(world.level.data.spirits)for(const b of world.boss.parts){if(!b.alive||b.x-cam>256||b.nativeArt&&!world.boss.activated)continue;const id=b.nativeArt||(b.kind==='armored'&&b.phase===2?'spirits_brain':'spirits_'+b.kind),a=assets[id];const el=this.sprite(id,b.nativeArt?b.visualX-cam:b.cx-cam-a.width/2,b.nativeArt?b.visualY:b.y+b.h-a.height);if(el&&(b.flash>0||b.telegraph))el.style.filter=b.flash>0?'brightness(2)':'brightness(1.35)';}
      this.human(world.player,cam,true);
      this.barrierLayer.hidden=!(world.level.data.spirits&&world.player.barrier>0&&world.player.alive&&world.player.respawnTimer===0);
      if(!this.barrierLayer.hidden){const p=world.player,h=p.prone?17:37,w=p.prone?32:24;move(this.barrierLayer,p.cx-cam-w/2,p.y+p.h-h+2);this.barrierLayer.style.height=px(h);this.barrierLayer.style.width=px(w);this.barrierLayer.classList.toggle('fading',p.barrier<=96/60);this.barrierLayer.classList.toggle('pulse',Math.floor(this.time*15)%2===1);}
      for(const b of world.bullets){
        if(b.delay>0||b.hiddenByMuzzle)continue;
        if(b.rom&&assets['c3_shot_'+b.code]){const id='c3_shot_'+b.code,a=assets[id];if(!b.exploding){const el=this.sprite(id,b.cx-cam-a.width/2,b.cy-a.height/2);el.style.transformOrigin='50% 50%';el.style.transform+=` rotate(${b.angle}rad)`;}continue;}
        let id='1e',face=1,flip=false;
        if(b.team==='enemy')id=b.kind==='cannon'?'21':'1e';else if(b.kind==='fire'||b.kind==='flame')id='22';else if(b.kind==='homing')id='20';else if(b.kind==='crush')id='21';else if(b.kind==='laser'){id=Math.abs(Math.cos(b.angle))<.05?'23':Math.abs(Math.sin(b.angle))<.05?'24':'25';face=Math.cos(b.angle)<0?-1:1;flip=Math.sin(b.angle)>0;}
        else if(b.kind==='spread'){const frame=Math.floor(b.age*60+1e-7);id=frame<16?'1f':frame<32?'20':'21';}else if(b.kind==='machine')id='1f';
        id=`sprite_${id}`;const a=assets[id];this.sprite(id,b.cx-cam-a.width/2,b.cy-a.height/2,face,flip);
      }
      if(world.state==='playing')for(const e of this.effects)e.age+=dt;
      this.effects=this.effects.filter(e=>e.age<e.duration);
      for(const e of this.effects){const id=e.type==='death'?`sprite_${e.age<.15?'0a':e.age<.4?'0b':'0c'}`:e.type==='hit'?'sprite_37':`sprite_${['37','36','35','39','3a'][Math.min(4,Math.floor(e.age/e.duration*5))]}`;const a=assets[id];this.sprite(id,e.x-cam-a.width/2,e.y-a.height/2);}
      for(let i=this.used;i<this.pool.length;i++)this.pool[i].hidden=true;
      const reserves=Math.max(0,world.lives-1),key=String(reserves);
      if(this.hud.dataset.lives!==key){this.hud.dataset.lives=key;this.hud.replaceChildren();for(let i=0;i<Math.min(8,reserves);i++){const el=element('nes-art art-player_1_lives_medal',this.hud);move(el,8+i*9,5);}if(reserves>8){const n=element('reserve-count',this.hud);n.textContent=key;}}
      this.bossMeter.hidden=!world.level.data.spirits||!world.boss.activated||!world.boss.alive;
      if(!this.bossMeter.hidden){const hp=world.boss.parts.reduce((n,p)=>n+p.hp,0),max=world.boss.parts.reduce((n,p)=>n+p.maxHp,0);this.bossMeter.textContent='BOSS '+Math.ceil(hp/max*100)+'%';this.bossMeter.style.borderBottomWidth=px(2);this.bossMeter.style.width=px(72*hp/max);}
      this.bombLayer.hidden=!(world.bombFlash>0);
      const message=world.clearTimer>0||world.state==='won'?`STAGE ${world.level.info?.number||1} CLEAR`:world.state==='paused'?'PAUSE':world.state==='gameover'?'GAME OVER':'';
      if(message){this.overlay.hidden=false;if(this.overlay.textContent!==message)this.overlay.textContent=message;}
    }
    destroy(){this.observer.disconnect();this.stage.remove();}
  }
  window.ContraCssTiles=CssTiles;window.ContraRenderer=Renderer;
})();

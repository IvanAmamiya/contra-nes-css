/* 魂斗罗 1 首关练习 · 纯 JavaScript 规则层，无 DOM / Canvas / 真实时钟依赖。 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./assets/stage1.js') : root.ContraStage1);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ContraCore = api;
})(typeof window !== 'undefined' ? window : this, function (stage1) {
  'use strict';
  // bank7: 8.8 定点重力每帧增加 $23；户外起跳速度 $FBF0。
  const WIDTH = 256, HEIGHT = 224, STEP = 1 / 60, GRAVITY = 35 / 256 * 3600;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  class Random {
    constructor(seed = 1337) { this.seed = seed >>> 0; }
    next() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  }
  class Entity {
    constructor(x, y, w, h) { Object.assign(this, { x, y, w, h, vx: 0, vy: 0, alive: true }); }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
  }
  class Character extends Entity {
    constructor(x, y, w, h, hp, team) { super(x, y, w, h); Object.assign(this, { hp, maxHp: hp, team, facing: 1, grounded: false, flash: 0 }); }
    takeDamage(amount, world) {
      if (!this.alive || amount <= 0) return false;
      this.hp = Math.max(0, this.hp - amount); this.flash = .08;
      if (this.hp === 0) { this.alive = false; this.onDeath(world); }
      return true;
    }
    onDeath() {}
  }
  class Bullet extends Entity {
    constructor(x, y, angle, team = 'player', speed = 180, kind = 'normal', damage = 1) {
      super(x - 1, y - 1, 2, 2);
      Object.assign(this, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, team, kind, damage, life: team === 'player' ? 1.8 : 4, age: 0, ox: x, oy: y, angle });
    }
    update(dt) {
      this.age += dt; this.life -= dt; this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.kind === 'fire') {
        this.x = this.ox + this.vx * this.age - Math.sin(this.angle) * Math.sin(this.age * 24) * 5 - 1;
        this.y = this.oy + this.vy * this.age + Math.cos(this.angle) * Math.sin(this.age * 24) * 5 - 1;
      }
    }
  }
  class Weapon {
    constructor(code, interval, angles, automatic = false, limit = 4, kind = 'normal') {
      Object.assign(this, { code, interval, angles, automatic, limit, kind, nextFireTime: 0 });
    }
    tryFire({ time, x, y, angle, held = true, pressed = true, turbo = false, activeCount = 0, rapid = false }) {
      if ((!held && !turbo) || (!this.automatic && !pressed && !turbo) || (turbo && time + 1e-9 < this.nextFireTime) || activeCount >= this.limit) return [];
      this.nextFireTime = time + .1;
      const speed = this.kind === 'laser' ? 240 : this.kind === 'fire' ? (rapid ? 120 : 90) : rapid ? 240 : 180;
      return this.angles.slice(0, this.limit - activeCount).map(offset => new Bullet(x, y, angle + offset, 'player', speed, this.kind, this.kind === 'laser' ? 3 : 1));
    }
  }
  class RifleWeapon extends Weapon { constructor() { super('N', .13, [0]); } }
  class MachineWeapon extends Weapon {
    constructor() { super('M', 8 / 60, [0], true, 6, 'machine'); this.fireTime = 7; }
    tryFire(ctx) {
      if (!ctx.held && !ctx.turbo) { this.fireTime = Math.min(7, (this.fireTime & 15) + 1); return []; }
      this.fireTime++;
      if ((this.fireTime & 15) < (this.fireTime < 96 ? 8 : 15)) return [];
      const next = this.fireTime + 16; this.fireTime = next >= 112 ? 0 : next & 240;
      if (ctx.activeCount >= 6) { this.fireTime = 7; return []; }
      return super.tryFire({ ...ctx, held: true, pressed: true, turbo: false });
    }
  }
  // bank6 s_bullet_x_vel_*: signed 8.8 values. Y uses the same table, shifted by 8 entries.
  const SPREAD_OFFSETS = [0,1,-1,2,-2];
  const SPREAD_SPEEDS = [
    [0,147,291,426,543,636,708,753,765,753,708,636,543,426,291,147,0,-147,-291,-426,-543,-636,-708,-753,-765,-753,-708,-636,-543,-426,-291,-147],
    [0,171,339,497,633,742,826,878,892,878,826,742,633,497,339,171,0,-171,-339,-497,-633,-742,-826,-878,-892,-878,-826,-742,-633,-497,-339,-171]
  ];
  class SpreadWeapon extends Weapon {
    constructor() { super('S', 0, SPREAD_OFFSETS.map(n=>n*Math.PI/16), false, 10, 'spread'); }
    tryFire(ctx) {
      // Reuse trigger/slot handling, then replace angular approximations with the NES velocity lookup.
      const shots=super.tryFire(ctx),speeds=SPREAD_SPEEDS[ctx.rapid?1:0];
      const base=(Math.round((ctx.angle+Math.PI/2)*16/Math.PI)+32)&31;
      return shots.map((b,i)=>{
        const index=(base+SPREAD_OFFSETS[i]+32)&31;
        b.vx=speeds[index]/256*60;b.vy=speeds[(index+24)&31]/256*60;
        b.angle=Math.atan2(b.vy,b.vx);return b;
      });
    }
  }
  class LaserWeapon extends Weapon {
    constructor() { super('L', 0, [0], true, 4, 'laser'); }
    tryFire(ctx) {
      if (!ctx.held && !ctx.turbo || !ctx.pressed && ctx.activeCount > 0) return [];
      const shots = [];
      for (const delay of [1, 4, 7, 10]) { const b = new Bullet(ctx.x, ctx.y, ctx.angle, 'player', 240, 'laser', 1); b.delay = delay / 60; shots.push(b); }
      return shots;
    }
  }
  class FireWeapon extends Weapon { constructor() { super('F', .18, [0], false, 4, 'fire'); } }
  const weaponFor = code => ({ N: RifleWeapon, M: MachineWeapon, S: SpreadWeapon, L: LaserWeapon, F: FireWeapon }[code] || RifleWeapon);
  class Player extends Character {
    constructor(x = 32, y = 74) {
      super(x, y, 12, 30, 1, 'player');
      Object.assign(this, { weapon: new RifleWeapon(), invincible: 128 / 60, barrier: 0, rapid: false, coyote: .06, jumpBuffer: 0, wasJump: false, wasFire: false, aim: 0, grounded: true, prone: false, inWater: false, submerged: false, dropTimer: 0, support: null, respawnTimer: 0 });
    }
    equip(weapon) { this.weapon = weapon; }
    takeDamage(amount, world) {
      if (amount <= 0 || this.invincible > 0 || this.respawnTimer > 0 || this.submerged || !this.alive) return false;
      return world.hurtPlayer();
    }
    resize(w, h) { const cx = this.cx, bottom = this.y + this.h; this.w = w; this.h = h; this.x = cx - w / 2; this.y = bottom - h; }
    update(dt, input, world) {
      if (this.respawnTimer > 0) {
        this.respawnTimer = Math.max(0, this.respawnTimer - dt);
        if (this.respawnTimer === 0) world.respawn();
        this.wasFire = !!input.fire; this.wasJump = !!input.jump; return;
      }
      this.invincible = Math.max(0, this.invincible - dt);
      this.barrier = Math.max(0, this.barrier - dt);
      this.dropTimer = Math.max(0, this.dropTimer - dt);
      const axis = Number(!!input.right) - Number(!!input.left), up = input.up && !input.down, down = input.down && !input.up;
      if (axis) this.facing = axis;
      this.submerged = this.inWater && down;
      this.prone = this.grounded && down && !axis && !this.inWater;
      this.resize(this.prone ? 24 : 12, this.inWater ? (this.submerged ? 5 : 16) : this.prone ? 9 : 30);
      this.vx = (this.prone || this.submerged ? 0 : axis * 60);
      this.coyote = this.grounded ? .065 : Math.max(0, this.coyote - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      if (input.jump && !this.wasJump) this.jumpBuffer = .09;
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        if (down && this.support && !this.support.bridge) { this.dropTimer = .22; this.y += 2; this.vy = 25; }
        else if (!this.submerged) { this.resize(12, 30); this.vy = -243.75; world.emit('jump', { x: this.cx, y: this.y }); }
        this.grounded = false; this.inWater = false; this.submerged = false; this.prone = false; this.coyote = 0; this.jumpBuffer = 0;
      }
      this.wasJump = !!input.jump;
      world.collision.move(this, dt, world.level);
      this.x = clamp(this.x, world.camera, world.level.width - this.w);
      if (this.y > HEIGHT + 24) { world.hurtPlayer(true); return; }
      if (up) this.aim = axis ? (axis > 0 ? -Math.PI / 4 : -Math.PI * 3 / 4) : -Math.PI / 2;
      else if (down && !this.prone && !this.submerged && !this.inWater) this.aim = axis ? (axis > 0 ? Math.PI / 4 : Math.PI * 3 / 4) : this.grounded ? (this.facing > 0 ? 0 : Math.PI) : Math.PI / 2;
      else this.aim = this.facing > 0 ? 0 : Math.PI;
      if (!this.submerged) {
        const muzzleY = this.prone ? this.y + 3 : this.inWater ? this.y + 6 : this.y + 11;
        if (this.weapon.code === 'L' && input.fire && !this.wasFire) for (const b of world.bullets) if (b.team === 'player') b.alive = false;
        const shots = this.weapon.tryFire({ time: world.time, x: this.cx + Math.cos(this.aim) * (this.prone ? 14 : 10), y: muzzleY + Math.sin(this.aim) * 9, angle: this.aim, held: !!input.fire, pressed: !!input.fire && !this.wasFire, turbo: !!input.turbo, rapid: this.rapid, activeCount: world.bullets.filter(b => b.team === 'player' && b.alive).length });
        world.bullets.push(...shots);
        if (shots.length) { world.shots += shots.length; world.emit('shot', { x: this.cx, y: muzzleY }); }
      }
      this.wasFire = !!input.fire;
    }
  }
  class RunnerAI {
    update(e, dt, world) {
      e.vx = e.facing * 40;
      world.collision.move(e, dt, world.level);
      if (e.grounded && e.x > e.jumpAt && !e.jumped) { e.vy = -200; e.grounded = false; e.jumped = true; }
    }
  }
  class SentryAI {
    update(e,dt,world) {
      e.vx=0;
      if(e.kind==='rifleman'){
        const direction=Math.sign(world.player.cx-e.cx);
        if(direction)e.facing=direction;
      }
    }
  }
  class Enemy extends Character {
    constructor(x, y, kind = 'runner', facing = -1) {
      super(x, y, kind === 'runner' || kind === 'rifleman' ? 12 : 24, kind === 'runner' || kind === 'rifleman' ? 27 : 24, kind === 'runner' ? 1 : kind === 'rifleman' ? 2 : 7, 'enemy');
      Object.assign(this, { kind, facing, nextShot: 0, activated: false, jumpAt: x + 48, jumped: false, ai: kind === 'runner' ? new RunnerAI() : new SentryAI() });
    }
    update(dt, world) {
      this.flash = Math.max(0, this.flash - dt);
      if (this.x > world.camera + WIDTH + 16 || this.spawnCamera > world.camera) return;
      if (this.x + this.w < world.camera - 40 || this.y > HEIGHT + 20) { this.alive = false; return; }
      if (!this.activated) { this.activated = true; this.nextShot = world.time + .95; }
      this.ai.update(this, dt, world);
      if (this.kind === 'runner' || world.player.respawnTimer > 0) return;
      if (world.time >= this.nextShot) {
        this.nextShot = world.time + (this.kind === 'turret' ? 1.7 : 2.1);
        const angle = Math.atan2(world.player.y + 10 - this.cy, world.player.cx - this.cx);
        const angles = this.kind === 'turret' && (!this.source || this.source.type === 7) ? [-.11, 0, .11] : [0];
        for (const offset of angles) world.bullets.push(new Bullet(this.cx + Math.cos(angle) * 12, this.cy, angle + offset, 'enemy', 75));
      }
    }
    onDeath(world) { world.kills++; world.addScore(this.kind === 'runner' ? 100 : this.kind === 'turret' ? 500 : 200); world.emit('explosion', { x: this.cx, y: this.cy, big: false }); }
  }
  class BossPart extends Enemy {
    constructor(x, y, kind, hp) {
      super(x, y, 'turret'); Object.assign(this, { kind, w: kind === 'core' ? 24 : 18, h: kind === 'core' ? 24 : 18, hp, maxHp: hp });
    }
    update(dt, world) {
      this.flash = Math.max(0, this.flash - dt);
      if (!world.boss.activated) return;
      if (this.kind === 'core' || world.player.respawnTimer > 0) return;
      if (!this.activated) { this.activated = true; this.nextShot = world.time + 1.2; }
      if (world.time >= this.nextShot) {
        this.nextShot = world.time + 1.65;
        const aim = Math.atan2(world.player.cy - this.cy, world.player.cx - this.cx);
        for (const offset of [-.12, .12]) world.bullets.push(new Bullet(this.x - 2, this.cy, aim + offset, 'enemy', 80, 'cannon'));
      }
    }
    onDeath(world) {
      world.kills++; world.addScore(this.kind === 'core' ? 5000 : 1000);
      world.emit('explosion', { x: this.cx, y: this.cy, big: this.kind === 'core' });
      if (this.kind === 'core') { world.boss.alive = false; world.clearTimer = 1.8; world.bullets = []; world.emit('bossDead', {}); }
    }
  }
  class Capsule extends Character {
    constructor(x, y, code = 'S', flying = true) { super(x, y, flying ? 22 : 18, 14, 1, 'enemy'); Object.assign(this, { kind: 'capsule', code, flying, originY: y, age: 0 }); }
    update(dt, world) {
      if ((!this.flying && this.x > world.camera + WIDTH + 12) || this.spawnCamera > world.camera) return;
      this.age += dt;
      // bank0: from screen x=$10, +1.5 px/frame; bank7: vy -= displacement*2/256 per frame.
      if (this.flying) { this.x += 90 * dt; this.vy -= (this.y-this.originY)*28.125*dt; this.y += this.vy*dt; }
      if (this.x + this.w < world.camera - 20 || this.x > world.camera + WIDTH + 32) this.alive = false;
    }
    onDeath(world) { world.pickups.push(new Pickup(this.cx - 7, this.cy - 5, this.code)); world.emit('explosion', { x: this.cx, y: this.cy }); }
  }
  class Pickup extends Entity {
    constructor(x, y, code = 'S') { super(x, y, 14, 11); this.code = code; this.vy = -90; this.life = 18; this.dropTimer = 0; }
    update(dt, world) { this.life -= dt; world.collision.move(this, dt, world.level); if (this.life <= 0 || this.x < world.camera - 20 || this.y > HEIGHT + 20) this.alive = false; }
    apply(world) {
      if (!this.alive) return;
      this.alive = false;
      if (this.code === 'R') world.player.rapid = true;
      else if (this.code === 'B') { world.player.invincible = 1024 / 60; world.player.barrier = 1024 / 60; }
      else { const WeaponType = weaponFor(this.code); world.player.equip(new WeaponType()); }
      world.addScore(100); world.emit('pickup', { x: this.cx, y: this.cy, code: this.code });
    }
  }
  class Level {
    constructor() {
      this.width=stage1.width; this.waterY=192; this.data=stage1;
      this.water=stage1.water.map(p=>({...p})); this.solids=stage1.solids.map(p=>({...p}));
      this.platforms=stage1.platforms.map(p=>({...p,active:true,breakAt:Infinity}));
      this.bossX=3216;
    }
    waterSurface(x,bottom=-Infinity) { const rows=this.water.filter(w=>x>=w.x&&x<w.x+w.w&&w.y+6>=bottom-.6); return rows.length?Math.min(...rows.map(w=>w.y)):null; }
    waterAt(x) { return this.water.some(w=>x>=w.x&&x<w.x+w.w); }
    safeSpawn(camera) {
      const candidates=this.platforms.filter(p=>p.active&&!p.bridge&&p.w>=16&&p.x+p.w>camera+20&&p.x<camera+200&&p.y<=192);
      candidates.sort((a,b)=>Math.abs(clamp(camera+40,a.x+2,a.x+a.w-14)-camera-40)-Math.abs(clamp(camera+40,b.x+2,b.x+b.w-14)-camera-40)||a.y-b.y);
      if(candidates.length){const p=candidates[0];return{x:clamp(camera+40,Math.max(camera+2,p.x+2),p.x+p.w-14),y:p.y-30};}
      return{x:camera+40,y:this.waterAt(camera+46)?162:32};
    }
    createEnemies() {
      return stage1.objects.filter(o=>[4,5,6,7].includes(o.type)).map(o=>{
        const kind=o.type===5?'runner':o.type===6?'rifleman':'turret';
        const e=new Enemy(o.cx-(kind==='turret'?12:6),o.cy+(kind==='turret'?-12:-11),kind);
        Object.assign(e,{source:o,spawnCamera:o.spawnCamera,attributes:o.attributes,visual:o.type===7?'red-turret':'turret'});return e;
      });
    }
    createCapsules() {return stage1.objects.filter(o=>o.type===2||o.type===3).map(o=>{
      const c=new Capsule(o.type===3?o.spawnCamera+16-11:o.cx-9,o.cy-7,['R','M','F','S','L','B'][o.attributes&7],o.type===3);
      if(c.flying)c.y+=32;
      c.source=o;c.spawnCamera=o.spawnCamera;return c;
    });}
    createBossParts() {return stage1.objects.filter(o=>o.type===16||o.type===17).sort((a,b)=>a.type-b.type).map(o=>{
      const p=new BossPart(o.cx-(o.type===17?8:9),o.cy-(o.type===17?16:9),o.type===17?'core':'bossGun',o.type===17?32:10);p.source=o;return p;
    });}
  }
  class CollisionSystem {
    move(body, dt, level) {
      body.x += body.vx * dt;
      const bottom = body.y + body.h;
      body.vy = Math.min(330, body.vy + GRAVITY * dt); body.y += body.vy * dt; body.grounded = false; body.support = null;
      if ('inWater' in body) body.inWater = false;
      let landing = null;
      if (body.vy >= 0 && !(body.dropTimer > 0)) for (const p of level.platforms) {
        if (!p.active || body.x + body.w <= p.x || body.x >= p.x + p.w || bottom > p.y + .6 || body.y + body.h < p.y) continue;
        if (!landing || p.y < landing.y) landing = p;
      }
      if (landing) { body.y = landing.y - body.h; body.vy = 0; body.grounded = true; body.support = landing; }
      else if (level.waterAt(body.cx) && body.vy >= 0) {
        const surface=level.waterSurface?level.waterSurface(body.cx,bottom):level.waterY;
        if(surface===null||body.y+body.h<surface+6)return;
        body.y = surface + 6 - body.h; body.vy = 0; body.grounded = true;
        if ('inWater' in body) body.inWater = true;
      }
    }
    segmentHit(x0, y0, x1, y1, box, radius = 1) {
      let lo = 0, hi = 1;
      for (const [p, d, min, max] of [[x0, x1 - x0, box.x - radius, box.x + box.w + radius], [y0, y1 - y0, box.y - radius, box.y + box.h + radius]]) {
        if (Math.abs(d) < 1e-10) { if (p < min || p > max) return null; }
        else { let a = (min - p) / d, b = (max - p) / d; if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b); if (lo > hi) return null; }
      }
      return lo;
    }
    updateBullets(world, dt) {
      for (const b of world.bullets) {
        if (!b.alive) continue;
        if (b.delay > 0) { b.delay -= dt; continue; }
        const x = b.cx, y = b.cy; b.update(dt);
        let closest = Infinity, target = null;
        const targets = b.team === 'player' ? [...world.enemies, ...world.capsules, ...world.boss.parts] : world.player.respawnTimer > 0 || world.player.submerged ? [] : [world.player];
        for (const e of targets) {
          if (!e.alive || e.spawnCamera > world.camera) continue;
          const t = this.segmentHit(x, y, b.cx, b.cy, e, b.kind === 'fire' ? 3 : 1);
          if (t !== null && t < closest) { closest = t; target = e; }
        }
        if (target) { b.alive = false; target.takeDamage(b.damage, world); world.emit('hit', { x: x + (b.cx - x) * closest, y: y + (b.cy - y) * closest }); }
        if (b.life <= 0 || b.x < world.camera - 16 || b.x > world.camera + WIDTH + 20 || b.y < -16 || b.y > HEIGHT + 8) b.alive = false;
      }
    }
  }
  class GameWorld {
    constructor(seed = 1337) { this.seed = seed; this.reset('title'); }
    reset(state = 'playing', lives = 3) {
      this.initialLives = lives; this.random = new Random(this.seed); this.level = new Level(); this.collision = new CollisionSystem();
      this.player = new Player(32,66); this.enemies = this.level.createEnemies(); this.capsules = this.level.createCapsules(); this.pickups = []; this.bullets = []; this.events = [];
      this.boss = { x: this.level.bossX, alive: true, activated: false, parts: this.level.createBossParts() };
      Object.assign(this, { state, time: 0, score: 0, lives, kills: 0, shots: 0, deaths: 0, camera: 0, farthest: 32, clearTimer: 0, nextExtraLife: 20000, nextSpawn: 3.5 });
    }
    emit(type, data) { this.events.push({ type, ...data }); if (this.events.length > 256) this.events.shift(); }
    drainEvents() { return this.events.splice(0); }
    addScore(value) { this.score += value; while (this.score >= this.nextExtraLife) { this.lives++; this.nextExtraLife += 30000; this.emit('extraLife', {}); } }
    togglePause() { if (this.state === 'playing') this.state = 'paused'; else if (this.state === 'paused') this.state = 'playing'; }
    hurtPlayer(fall = false) {
      if (this.state !== 'playing' || this.clearTimer > 0 || this.player.respawnTimer > 0 || (!fall && this.player.invincible > 0)) return false;
      this.lives--; this.deaths++; this.emit('death', { x: this.player.cx, y: Math.min(this.player.cy, HEIGHT - 10) });
      this.player.equip(new RifleWeapon()); this.player.rapid = false; this.player.barrier = 0; this.player.respawnTimer = 1;
      if (this.lives <= 0) { this.state = 'gameover'; this.player.alive = false; }
      return true;
    }
    respawn() {
      const spawn = this.level.safeSpawn(this.camera);
      Object.assign(this.player, { ...spawn, w: 12, h: 30, vx: 0, vy: 0, invincible: 128 / 60, grounded: false, coyote: 0, jumpBuffer: 0, respawnTimer: 0, inWater: false, prone: false, submerged: false, dropTimer: 0, support: null });
      for (const b of this.bullets) if (b.team === 'enemy') b.alive = false;
    }
    update(dt, input = {}) {
      if (this.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .05); this.time += dt;
      if (this.clearTimer > 0) { this.clearTimer = Math.max(0, this.clearTimer - dt); if (this.clearTimer === 0) { this.state = 'won'; this.emit('win', {}); } return; }
      this.player.update(dt, input, this);
      if (this.state !== 'playing') return;
      this.farthest = Math.max(this.farthest, this.player.x);
      this.camera = Math.max(this.camera, clamp(this.player.cx - 114, 0, this.level.width - WIDTH));
      if (this.camera >= this.level.width - WIDTH - 1 && !this.boss.activated) { this.camera=this.level.width-WIDTH; this.boss.activated = true; this.emit('boss', {}); }
      if (this.boss.alive) this.player.x = Math.min(this.player.x, this.boss.x - this.player.w - 3);
      for (const bridge of this.level.platforms) if (bridge.bridge && bridge.active) {
        if (this.player.x > bridge.x - 12 && bridge.breakAt === Infinity) bridge.breakAt = this.time + .8;
        if (this.time >= bridge.breakAt) { bridge.active = false; this.emit('explosion', { x: bridge.x + bridge.w / 2, y: bridge.y + 4, big: true }); }
      }
      for (const enemy of this.enemies) if (enemy.alive) enemy.update(dt, this);
      for (const part of this.boss.parts) if (part.alive) part.update(dt, this);
      for (const capsule of this.capsules) if (capsule.alive) capsule.update(dt, this);
      for (const pickup of this.pickups) if (pickup.alive) pickup.update(dt, this);
      this.collision.updateBullets(this, dt);
      if (this.state !== 'playing' || this.clearTimer > 0) return;
      if (this.player.respawnTimer === 0) {
        for (const enemy of this.enemies) if (enemy.alive && !(enemy.spawnCamera > this.camera) && overlap(this.player, enemy)) { if (this.player.barrier > 0) enemy.takeDamage(enemy.hp, this); else this.player.takeDamage(1, this); break; }
        if (this.player.respawnTimer === 0) for (const pickup of this.pickups) if (pickup.alive && overlap(this.player, pickup)) pickup.apply(this);
      }
      if (this.time >= this.nextSpawn && this.camera < this.level.width - WIDTH - 100) {
        this.nextSpawn = this.time + 3.1 + this.random.next();
        const x = this.camera + WIDTH + 4;
        const p = this.level.platforms.find(p => p.active && x >= p.x && x <= p.x + p.w && !p.bridge);
        if (p) this.enemies.push(new Enemy(x, p.y - 27));
      }
      this.enemies = this.enemies.filter(e => e.alive); this.capsules = this.capsules.filter(e => e.alive); this.pickups = this.pickups.filter(p => p.alive); this.bullets = this.bullets.filter(b => b.alive);
    }
  }
  class FixedClock {
    constructor() { this.accumulator = 0; }
    advance(elapsed, tick) {
      if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
      this.accumulator += Math.min(elapsed, .1); let steps = 0;
      while (this.accumulator + 1e-10 >= STEP) { tick(STEP); this.accumulator -= STEP; steps++; } return steps;
    }
    reset() { this.accumulator = 0; }
  }
  return { WIDTH, HEIGHT, STEP, GRAVITY, clamp, overlap, Random, Entity, Character, Bullet, Weapon, RifleWeapon, MachineWeapon, SpreadWeapon, LaserWeapon, FireWeapon, Player, Enemy, BossPart, Capsule, RunnerAI, SentryAI, Pickup, Level, CollisionSystem, GameWorld, FixedClock };
});

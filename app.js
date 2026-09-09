(function () {
  'use strict';
  const { GameWorld, FixedClock } = window.ContraCore;
  const $ = id => document.getElementById(id), viewport = $('game');
  const expansion=window.ContraSpirits;
  let saved={};try{saved=JSON.parse(window.localStorage?.getItem('contra-settings-v2')||'{}')||{};}catch(_){}
  const stageIds=['nes',...(expansion?expansion.STAGES.map(s=>s.id):[])];
  $('stage-select').value=stageIds.includes(saved.stage)?saved.stage:expansion?'city':'nes';
  $('lives-select').value=saved.lives===3?'3':'30';
  let world = expansion&&$('stage-select').value!=='nes'?new expansion.SpiritsWorld($('stage-select').value):new GameWorld();
  const clock = new FixedClock(), renderer = new window.ContraRenderer(viewport);
  class Input {
    constructor() { this.keys = new Set(); this.pointers = new Map(); this.pulses = new Set(); }
    get state() {
      const has = (...keys) => keys.some(k => this.keys.has(k)), touch = name => [...this.pointers.values()].includes(name);
      return { left: has('KeyA','ArrowLeft') || touch('left'), right: has('KeyD','ArrowRight') || touch('right'), up: has('KeyW','ArrowUp') || touch('up'), down: has('KeyS','ArrowDown') || touch('down'), jump: has('Space','KeyK','KeyZ') || touch('jump') || this.pulses.has('jump'), fire: has('KeyJ','KeyX') || touch('fire') || this.pulses.has('fire'), turbo: has('KeyH') || touch('turbo'),swap:has('KeyQ')||touch('swap')||this.pulses.has('swap'),bomb:has('KeyE')||touch('bomb')||this.pulses.has('bomb'),lock:has('ShiftLeft','ShiftRight')||touch('lock'),spin:has('KeyU')||touch('spin') };
    }
    clear() { this.keys.clear(); this.pointers.clear(); this.pulses.clear(); document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('active')); }
  }
  class Sound {
    constructor() { this.enabled = false; this.context = null; }
    unlock() {
      if (!this.enabled) return;
      try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) return; if (!this.context) this.context = new Audio(); if (this.context.state === 'suspended') this.context.resume().catch(() => {}); }
      catch (_) { this.enabled = false; }
    }
    tone(freq, end, duration, type = 'square', volume = .025) {
      if (!this.enabled || !this.context || this.context.state !== 'running') return;
      const c = this.context, t = c.currentTime, osc = c.createOscillator(), gain = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration); gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      osc.connect(gain); gain.connect(c.destination); osc.start(t); osc.stop(t + duration); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    event(e) {
      if (e.type === 'shot') this.tone(210, 60, .06, 'square', .018);
      if (e.type === 'jump') this.tone(260, 540, .09, 'square', .015);
      if (e.type === 'explosion' || e.type === 'death') this.tone(125, 24, e.big ? .35 : .16, 'sawtooth', .04);
      if (e.type === 'pickup') this.tone(520, 1300, .18, 'triangle', .06);
      if (e.type === 'win') this.tone(392, 1568, .7, 'triangle', .045);
    }
  }
  const input = new Input(), sound = window.ContraAudio?new window.ContraAudio.Sound(window.SpiritsSamples?.samples):new Sound();
  sound.enabled=saved.sound===true;
  let previousState = '', lastTime = null, practice = false, codeIndex = 0;
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  function text(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
  function persist(){try{window.localStorage?.setItem('contra-settings-v2',JSON.stringify({stage:$('stage-select').value,lives:Number($('lives-select').value),sound:sound.enabled}));}catch(_){}}
  function highScore(){let n=0;try{n=Number(window.localStorage?.getItem('contra-best-'+$('stage-select').value+'-'+$('lives-select').value))||0;}catch(_){}return Math.max(0,n);}
  function newGame() { const id=$('stage-select').value;world=expansion&&id!=='nes'?new expansion.SpiritsWorld(id):new GameWorld();world.reset('playing',practice?30:Number($('lives-select').value)||30);sound.stop?.();renderer.clear(); clock.reset(); input.clear(); lastTime = null;previousState='';persist(); sound.unlock(); sync(); viewport.focus({ preventScroll: true }); }
  function pause() { world.togglePause(); input.clear(); clock.reset();if(world.state!=='playing')sound.stop?.();sync(); if (world.state === 'playing') viewport.focus({ preventScroll: true }); }
  function action() { if (world.state === 'paused') pause(); else if (world.state !== 'playing') newGame(); }
  function toggleSound() { sound.enabled = !sound.enabled;if(!sound.enabled)sound.stop?.();sound.unlock();persist();text('sound-button', `声音：${sound.enabled ? '开' : '关'}`); $('sound-button').setAttribute('aria-pressed', String(sound.enabled)); if (sound.enabled) sound.tone(440, 660, .07, 'triangle'); }
  function sync() {
    text('lives', `生命 ${world.lives}`); text('weapon', `武器 ${world.player.weapon.code}${world.player.rapid ? '+R' : ''}`); text('score', `得分 ${String(world.score).padStart(6,'0')}`);
    text('arsenal',world.player.slots?`槽 ${world.player.activeSlot+1} · ${world.player.slots.map(w=>w.code).join(' / ')}　炸弹 ${world.player.bombs}${world.player.clinging?'　攀附中':''}`:'NES 原版规则');
    $('stage-select').disabled=world.state==='playing';$('lives-select').disabled=world.state==='playing';
    $('next-button').hidden=world.state!=='won'||!world.level.id||world.level.id==='hive';
    if (world.state === previousState) return;
    previousState = world.state;
    const labels = { title: '待机', playing: '游戏中', paused: '已暂停', gameover: 'GAME OVER', won: '关卡通关' };
    text('state-label', labels[world.state]); text('live-status', labels[world.state]);
    $('menu').hidden = world.state === 'playing'; $('menu').classList.toggle('result', world.state !== 'title');
    $('pause-button').disabled = !['playing','paused'].includes(world.state); text('pause-button', world.state === 'paused' ? '继续' : '暂停');
    text('best',`最高 ${highScore()}`);
    if (world.state === 'playing') return;
    if(['won','gameover'].includes(world.state)){try{window.localStorage?.setItem('contra-best-'+$('stage-select').value+'-'+$('lives-select').value,String(Math.max(highScore(),world.score)));}catch(_){}text('best',`最高 ${Math.max(highScore(),world.score)}`);}
    const config = world.state === 'title'?['魂斗罗',world.level.info?.name||'第一关 · 丛林','▶ 1 PLAYER','自由选关 · 30 命练习']:world.state === 'paused' ? ['暂停', '游戏已暂停', '▶ CONTINUE', 'P / ENTER 继续 · R 重开'] : world.state === 'won' ? ['关卡通关', `得分 ${world.score} · 击破 ${world.kills} · ${Math.floor(world.time)} 秒`, '▶ PLAY AGAIN', '可继续下一关或自由选关'] : ['GAME OVER', `得分 ${world.score} · 击破 ${world.kills}`, '▶ RETRY', 'ENTER 重试当前关卡'];
    text('menu-title', config[0]); text('menu-info', config[1]); text('start-button', config[2]); text('menu-hint', config[3]); $('start-button').focus({ preventScroll: true });
  }
  const gameKeys = new Set(['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyK','KeyZ','KeyJ','KeyX','KeyH','KeyQ','KeyE','KeyU','ShiftLeft','ShiftRight']);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (world.state === 'title' && !e.repeat && e.code !== 'Enter') {
      if (e.code === konami[codeIndex]) codeIndex++; else codeIndex = e.code === konami[0] ? 1 : 0;
      if (codeIndex === konami.length) { practice = true;$('lives-select').value='30';codeIndex = 0; text('menu-info', '30 命练习已开启'); text('live-status', '30 命练习已开启'); }
    }
    if (e.code === 'Enter' && !e.repeat && !['BUTTON','A','SUMMARY'].includes(e.target.tagName)) { e.preventDefault(); world.state === 'playing' ? pause() : action(); return; }
    if (['KeyP','Escape'].includes(e.code) && !e.repeat) { e.preventDefault(); pause(); return; }
    if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleSound(); return; }
    if (e.code === 'KeyR' && world.state === 'paused' && !e.repeat) { e.preventDefault(); newGame(); return; }
    if (gameKeys.has(e.code) && (world.state === 'playing' || world.state === 'title')) { e.preventDefault(); if (world.state === 'playing') { input.keys.add(e.code); if (!e.repeat) { if (['Space','KeyK','KeyZ'].includes(e.code)) input.pulses.add('jump'); if (['KeyJ','KeyX'].includes(e.code)) input.pulses.add('fire');if(e.code==='KeyQ')input.pulses.add('swap');if(e.code==='KeyE')input.pulses.add('bomb'); } sound.unlock(); } }
  });
  document.addEventListener('keyup', e => input.keys.delete(e.code));
  $('start-button').addEventListener('click', action); $('pause-button').addEventListener('click', pause); $('sound-button').addEventListener('click', toggleSound);
  function selectStage(){persist();input.clear();sound.stop?.();const id=$('stage-select').value;world=expansion&&id!=='nes'?new expansion.SpiritsWorld(id):new GameWorld();world.reset('title',Number($('lives-select').value)||30);practice=false;previousState='';renderer.clear();clock.reset();sync();}
  $('stage-select').addEventListener('change',selectStage);$('lives-select').addEventListener('change',selectStage);
  $('next-button').addEventListener('click',()=>{const n=expansion.STAGES.findIndex(s=>s.id===world.level.id);if(n>=0&&n<2){$('stage-select').value=expansion.STAGES[n+1].id;newGame();}});
  viewport.addEventListener('pointerdown', () => { viewport.focus({ preventScroll: true }); sound.unlock(); });
  function loseFocus() { input.clear(); if (world.state === 'playing') pause(); }
  window.addEventListener('blur', loseFocus); document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); clock.reset(); lastTime = null; });
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); if (world.state !== 'playing') return; button.setPointerCapture(e.pointerId); input.pointers.set(e.pointerId, button.dataset.control); if (['jump','fire','swap','bomb'].includes(button.dataset.control)) input.pulses.add(button.dataset.control); button.classList.add('active'); sound.unlock(); });
    const release = e => { input.pointers.delete(e.pointerId); if (![...input.pointers.values()].includes(button.dataset.control)) button.classList.remove('active'); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release); button.addEventListener('contextmenu', e => e.preventDefault());
  });
  function frame(timestamp) {
    const dt = lastTime === null ? 0 : Math.min(.1, (timestamp - lastTime) / 1000); lastTime = timestamp;
    if (world.state === 'playing') clock.advance(dt, step => {
      world.update(step, input.state);
      input.pulses.clear();
      for (const event of world.drainEvents()) { renderer.event(event); sound.event(event); if (event.type === 'pickup') text('live-status', `已拾取 ${event.code}`); if (event.type === 'death') text('live-status', `受击，剩余 ${world.lives} 条命`); }
    });
    sound.update?.(world);sync(); renderer.draw(world, dt); requestAnimationFrame(frame);
  }
  text('sound-button',`声音：${sound.enabled?'开':'关'}`);$('sound-button').setAttribute('aria-pressed',String(sound.enabled));sync(); requestAnimationFrame(frame);
})();


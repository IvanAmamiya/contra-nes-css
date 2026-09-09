(function () {
  'use strict';
  const { GameWorld, FixedClock } = window.ContraCore;
  const $ = id => document.getElementById(id), viewport = $('game');
  const world = new GameWorld(), clock = new FixedClock(), renderer = new window.ContraRenderer(viewport);
  class Input {
    constructor() { this.keys = new Set(); this.pointers = new Map(); this.pulses = new Set(); }
    get state() {
      const has = (...keys) => keys.some(k => this.keys.has(k)), touch = name => [...this.pointers.values()].includes(name);
      return { left: has('KeyA','ArrowLeft') || touch('left'), right: has('KeyD','ArrowRight') || touch('right'), up: has('KeyW','ArrowUp') || touch('up'), down: has('KeyS','ArrowDown') || touch('down'), jump: has('Space','KeyK','KeyZ') || touch('jump') || this.pulses.has('jump'), fire: has('KeyJ','KeyX') || touch('fire') || this.pulses.has('fire'), turbo: has('KeyH') || touch('turbo') };
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
  const input = new Input(), sound = new Sound();
  let previousState = '', lastTime = null, practice = false, codeIndex = 0;
  const konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  function text(id, value) { if ($(id).textContent !== value) $(id).textContent = value; }
  function newGame() { world.reset('playing', practice ? 30 : 3); renderer.clear(); clock.reset(); input.clear(); lastTime = null; sound.unlock(); sync(); viewport.focus({ preventScroll: true }); }
  function pause() { world.togglePause(); input.clear(); clock.reset(); sync(); if (world.state === 'playing') viewport.focus({ preventScroll: true }); }
  function action() { if (world.state === 'paused') pause(); else if (world.state !== 'playing') newGame(); }
  function toggleSound() { sound.enabled = !sound.enabled; sound.unlock(); text('sound-button', `声音：${sound.enabled ? '开' : '关'}`); $('sound-button').setAttribute('aria-pressed', String(sound.enabled)); if (sound.enabled) sound.tone(440, 660, .07, 'triangle'); }
  function sync() {
    text('lives', `生命 ${world.lives}`); text('weapon', `武器 ${world.player.weapon.code}${world.player.rapid ? '+R' : ''}`); text('score', `得分 ${String(world.score).padStart(6,'0')}`);
    if (world.state === previousState) return;
    previousState = world.state;
    const labels = { title: '待机', playing: '游戏中', paused: '已暂停', gameover: 'GAME OVER', won: '第一关通关' };
    text('state-label', labels[world.state]); text('live-status', labels[world.state]);
    $('menu').hidden = world.state === 'playing'; $('menu').classList.toggle('result', world.state !== 'title');
    $('pause-button').disabled = !['playing','paused'].includes(world.state); text('pause-button', world.state === 'paused' ? '继续' : '暂停');
    if (world.state === 'playing' || world.state === 'title') return;
    const config = world.state === 'paused' ? ['暂停', '游戏已暂停', '▶ CONTINUE', 'P / ENTER 继续 · R 重开'] : world.state === 'won' ? ['第一关通关', `得分 ${world.score} · 击破 ${world.kills} · ${Math.floor(world.time)} 秒`, '▶ PLAY AGAIN', '首关 MVP 完成 · ENTER 再玩'] : ['GAME OVER', `得分 ${world.score} · 击破 ${world.kills}`, '▶ RETRY', 'ENTER 从第一关重试'];
    text('menu-title', config[0]); text('menu-info', config[1]); text('start-button', config[2]); text('menu-hint', config[3]); $('start-button').focus({ preventScroll: true });
  }
  const gameKeys = new Set(['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyK','KeyZ','KeyJ','KeyX','KeyH']);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    if (world.state === 'title' && !e.repeat && e.code !== 'Enter') {
      if (e.code === konami[codeIndex]) codeIndex++; else codeIndex = e.code === konami[0] ? 1 : 0;
      if (codeIndex === konami.length) { practice = true; codeIndex = 0; text('menu-info', '30 命练习已开启'); text('live-status', '30 命练习已开启'); }
    }
    if (e.code === 'Enter' && !e.repeat && !['BUTTON','A','SUMMARY'].includes(e.target.tagName)) { e.preventDefault(); world.state === 'playing' ? pause() : action(); return; }
    if (['KeyP','Escape'].includes(e.code) && !e.repeat) { e.preventDefault(); pause(); return; }
    if (e.code === 'KeyM' && !e.repeat) { e.preventDefault(); toggleSound(); return; }
    if (e.code === 'KeyR' && world.state === 'paused' && !e.repeat) { e.preventDefault(); newGame(); return; }
    if (gameKeys.has(e.code) && (world.state === 'playing' || world.state === 'title')) { e.preventDefault(); if (world.state === 'playing') { input.keys.add(e.code); if (!e.repeat) { if (['Space','KeyK','KeyZ'].includes(e.code)) input.pulses.add('jump'); if (['KeyJ','KeyX'].includes(e.code)) input.pulses.add('fire'); } sound.unlock(); } }
  });
  document.addEventListener('keyup', e => input.keys.delete(e.code));
  $('start-button').addEventListener('click', action); $('pause-button').addEventListener('click', pause); $('sound-button').addEventListener('click', toggleSound);
  viewport.addEventListener('pointerdown', () => { viewport.focus({ preventScroll: true }); sound.unlock(); });
  function loseFocus() { input.clear(); if (world.state === 'playing') pause(); }
  window.addEventListener('blur', loseFocus); document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); clock.reset(); lastTime = null; });
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); if (world.state !== 'playing') return; button.setPointerCapture(e.pointerId); input.pointers.set(e.pointerId, button.dataset.control); if (['jump','fire'].includes(button.dataset.control)) input.pulses.add(button.dataset.control); button.classList.add('active'); sound.unlock(); });
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
    sync(); renderer.draw(world, dt); requestAnimationFrame(frame);
  }
  sync(); requestAnimationFrame(frame);
})();


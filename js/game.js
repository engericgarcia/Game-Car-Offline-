/* ============================================================
   game.js - laço principal, telas, controles e regras
   ============================================================ */
'use strict';

const Game = {
  state: 'menu',           /* menu | countdown | racing | paused | over */
  mode: 'race',            /* race | time | drift */
  trackDef: TRACK_DEFS[0],
  teamId: TEAMS[0].id,
  track: null, layer: null, marks: null, parts: null,
  cars: [], ais: [], player: null,
  cam: { x: 0, y: 0, zoom: 1 },
  clock: 0, countdown: 0, raceTime: 0, driftTimeLeft: 0,
  totalLaps: 3, finishOrder: [],
  settings: { autoGas: false, assist: true, sound: true, opponents: 9, difficulty: 1, laps: 0 },
  records: {},
  teamPickFor: 'quick',      /* de onde a tela de equipes foi aberta */
  seasonTab: 'cal',
  lastPoints: null,
  toast: { text: '', life: 0 },
  driftPop: { text: '', life: 0 }
};

/* ---------------- armazenamento ---------------- */
function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem('gc_settings') || '{}');
    Object.assign(Game.settings, s);
    if (s.teamId && teamById(s.teamId).id === s.teamId) Game.teamId = s.teamId;
    delete Game.settings.teamId;
    Game.records = JSON.parse(localStorage.getItem('gc_records') || '{}');
  } catch (e) { }
}
function saveSettings() {
  try {
    const s = Object.assign({}, Game.settings, { teamId: Game.teamId });
    localStorage.setItem('gc_settings', JSON.stringify(s));
  } catch (e) { }
}
function saveRecords() {
  try { localStorage.setItem('gc_records', JSON.stringify(Game.records)); } catch (e) { }
}
function rec(trackId) {
  return Game.records[trackId] || (Game.records[trackId] = { best: null, drift: 0 });
}

/* ---------------- canvas ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, dpr = 1;
let safeTop = 0, safeLeft = 0, safeBottom = 0;

/* lê as margens seguras (notch do iPhone) uma vez por redimensionamento */
function readSafeArea() {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) ' +
    'env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  safeTop = parseFloat(cs.paddingTop) || 0;
  safeLeft = parseFloat(cs.paddingLeft) || 0;
  safeBottom = parseFloat(cs.paddingBottom) || 0;
  d.remove();
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const r = canvas.getBoundingClientRect();
  cw = r.width; ch = r.height;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  readSafeArea();
  document.body.classList.toggle('landscape', cw > ch);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

/* ---------------- controles ---------------- */
const keys = {};
const touch = { left: false, right: false, gas: false, brake: false, drift: false };

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && (Game.state === 'racing' || Game.state === 'over')) startRace();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function bindTouch() {
  document.querySelectorAll('[data-btn]').forEach(el => {
    const k = el.dataset.btn;
    const on = e => { e.preventDefault(); touch[k] = true; el.classList.add('down'); Sound.init(); };
    const off = e => { e.preventDefault(); touch[k] = false; el.classList.remove('down'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', e => e.preventDefault());
  });
}

function playerInput() {
  const s = Game.settings;
  let steer = 0;
  if (keys.ArrowLeft || keys.KeyA || touch.left) steer -= 1;
  if (keys.ArrowRight || keys.KeyD || touch.right) steer += 1;
  let gas = (keys.ArrowUp || keys.KeyW || touch.gas) ? 1 : 0;
  let brake = (keys.ArrowDown || keys.KeyS || touch.brake) ? 1 : 0;
  const hand = (keys.Space || keys.ShiftLeft || touch.drift) ? true : false;
  if (s.autoGas && !brake) gas = 1;
  if (Game.state !== 'racing') { gas = Game.state === 'countdown' ? gas * 0 : 0; brake = 0; }
  return { steer: steer, throttle: gas, brake: brake, handbrake: hand };
}

/* ---------------- montagem da corrida ---------------- */
function prepareTrack(def) {
  Game.trackDef = def;
  Game.track = buildTrack(def);
  Game.layer = buildTrackLayer(Game.track);
  Game.marks = makeMarksLayer(Game.track);
  Game.parts = new Particles();
}

/* Quem está no grid, e em que ordem. */
function buildEntries() {
  if (Game.mode === 'story') return Season.gridOrder();
  const team = teamById(Game.teamId);
  const player = makeEntry(team, 0, true);
  if (Game.mode !== 'race') return [player];

  const others = [];
  for (const t of TEAMS) {
    for (let d = 0; d < t.drivers.length; d++) {
      if (t.id === team.id && d === 0) continue;
      others.push(makeEntry(t, d, false));
    }
  }
  others.sort((a, b) => b.team.tier - a.team.tier);
  const grid = others.slice(0, clamp(Game.settings.opponents, 0, others.length));
  grid.push(player);            /* na corrida rápida o jogador larga por último */
  return grid;
}

function startRace() {
  const def = Game.trackDef;
  if (!Game.track || Game.track.def.id !== def.id) prepareTrack(def);
  else { Game.marks = makeMarksLayer(Game.track); Game.parts = new Particles(); }

  const entries = buildEntries();
  const g = makeGrid(Game.track, entries, Game.settings.difficulty);
  Game.cars = g.cars; Game.ais = g.ais;
  Game.player = g.cars.find(c => c.isPlayer);
  Game.player.assist = Game.settings.assist ? 0.6 : 0.12;
  for (const c of Game.cars) { if (!c.isPlayer) c.assist = 0.5; }

  Game.totalLaps = (Game.mode === 'race' || Game.mode === 'story')
    ? (Game.mode === 'story' ? def.laps : (Game.settings.laps || def.laps)) : 99;
  Game.finishOrder = [];
  Game.raceTime = 0;
  Game.driftTimeLeft = 90;
  Game.countdown = (Game.mode === 'race' || Game.mode === 'story') ? 3.6 : 2.2;
  Game.state = 'countdown';
  Game.clock = performance.now();
  Game.cam.x = Game.player.x; Game.cam.y = Game.player.y;
  Game.cam.zoom = baseZoom();
  Game.toast.life = 0; Game.driftPop.life = 0;

  showScreen(null);
  document.body.classList.add('playing');
  document.getElementById('hud').classList.remove('hidden');
  updateHudStatic();
  Sound.init();
}

/* quanto do mundo cabe na menor dimensão da tela.
   Pista larga precisa de campo de visão maior, senão não se vê a curva. */
const VIEW_UNITS = 440;
function baseZoom() { return clamp(Math.min(cw, ch) / VIEW_UNITS, 0.45, 2.4); }

/* ---------------- laço principal ---------------- */
let last = performance.now(), acc = 0;
const STEP = 1 / 120;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;

  if (Game.state === 'countdown' || Game.state === 'racing' || Game.state === 'over') {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 12) { simulate(STEP, now); acc -= STEP; }
    render(now, dt);
  } else if (Game.state === 'paused') {
    render(now, 0);
  }
  hudTick(dt);
}

function simulate(dt, now) {
  const G = Game;

  if (G.state === 'countdown') {
    G.countdown -= dt;
    const prev = Math.ceil(G.countdown + dt);
    const cur = Math.ceil(G.countdown);
    if (cur !== prev && cur >= 0 && cur <= 3) Sound.blip(cur === 0 ? 880 : 440, 0.18, 'square', 0.22);
    if (G.countdown <= 0) {
      G.state = 'racing';
      G.raceTime = 0;
      for (const c of G.cars) { c.lapStart = 0; c.lap = 0; c.prevIdx = c.idx; c.halfPassed = true; }
    }
  } else if (G.state === 'racing') {
    G.raceTime += dt * 1000;
    if (G.mode === 'drift') {
      G.driftTimeLeft -= dt;
      if (G.driftTimeLeft <= 0) { G.driftTimeLeft = 0; endRace(); }
    }
  }

  const inp = playerInput();

  for (let i = 0; i < G.ais.length; i++) {
    const ai = G.ais[i];
    const c = ai.car;
    if (G.state === 'countdown') { c.update(dt, { steer: 0, throttle: 0, brake: 0, handbrake: true }, G.raceTime); continue; }
    const a = ai.think(dt, G.raceTime);
    c.brakeGlow = a.brake > 0.1 ? 0.9 : 0;
    c.update(dt, a, G.raceTime);
  }

  const p = G.player;
  p.brakeGlow = inp.brake > 0.1 ? 0.9 : 0;
  const wasLap = p.lap;
  p.update(dt, inp, G.raceTime);
  if (p.lap !== wasLap && p.lastLap) onLapDone(p);

  resolveCarCollisions(G.cars, G.track.n);

  /* efeitos */
  for (const c of G.cars) {
    paintTireMarks(G.marks, c);
    emitCarParticles(G.parts, c, dt);
  }
  G.parts.update(dt);

  /* fim de corrida */
  if (G.state === 'racing' && (G.mode === 'race' || G.mode === 'story')) {
    for (const c of G.cars) {
      if (!c.finished && c.lap > G.totalLaps) {
        c.finished = true;
        c.finishTime = G.raceTime;
        G.finishOrder.push(c);
        if (c.isPlayer) endRace();
      }
    }
  }
}

function onLapDone(p) {
  const r = rec(Game.trackDef.id);
  if (p.lastLap && (r.best == null || p.lastLap < r.best)) {
    r.best = p.lastLap; saveRecords();
    showToast('NOVO RECORDE! ' + fmtTime(p.lastLap), 2.6);
    Sound.blip(1320, 0.25, 'triangle', 0.2);
  } else if (p.lastLap) {
    showToast('Volta ' + fmtTime(p.lastLap), 1.8);
  }
}

/* Classificação final: quem cruzou, por tempo; o resto, por distância
   percorrida no momento em que o jogador terminou. */
function finishingOrder() {
  return Game.cars.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.progress() - a.progress();
  });
}

function endRace() {
  Game.state = 'over';
  const p = Game.player;
  p.driftScore += Math.round(p.driftBank * p.driftCombo);
  const r = rec(Game.trackDef.id);
  let newDrift = false;
  if (p.driftScore > (r.drift || 0)) { r.drift = p.driftScore; newDrift = true; }
  saveRecords();

  if (Game.mode === 'story' && Season.active()) {
    const order = finishingOrder();
    Game.lastOrder = order;
    Game.lastPoints = Season.applyResult(order.map(c => c.entry.id));
  }
  setTimeout(() => showResults(newDrift), 700);
}

/* ---------------- desenho ---------------- */
function render(now, dt) {
  const G = Game, p = G.player;
  if (!p) return;

  /* câmera */
  const lead = 0.30;
  const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
  const k = Math.min(1, (dt || 0.016) * 5.5);
  G.cam.x = lerp(G.cam.x, tx, k);
  G.cam.y = lerp(G.cam.y, ty, k);
  const zTarget = baseZoom() * (1 - 0.16 * clamp(p.speed / p.spec.top, 0, 1));
  G.cam.zoom = lerp(G.cam.zoom, zTarget, Math.min(1, (dt || 0.016) * 2.5));

  let shake = 0;
  if (p.hitTimer > 0) shake = p.hitTimer * 14;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = G.layer.bg || '#12151a';
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.scale(G.cam.zoom, G.cam.zoom);
  ctx.translate(-G.cam.x, -G.cam.y);

  const b = G.layer.bounds;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(G.layer.canvas, b.x, b.y, b.w, b.h);
  ctx.drawImage(G.marks.canvas, b.x, b.y, b.w, b.h);
  G.parts.draw(ctx);

  for (const c of G.cars) if (!c.isPlayer) drawCar(ctx, c);
  drawCar(ctx, p);
  if (G.state === 'countdown') drawPlayerArrow(ctx, p, now);

  ctx.restore();

  /* minimapa */
  const ms = clamp(Math.min(cw, ch) * 0.19, 70, 130);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMinimap(ctx, G.track, G.cars, 20 + safeLeft, 62 + safeTop, ms);

  /* contagem regressiva */
  if (G.state === 'countdown') {
    const n = Math.ceil(G.countdown);
    const txt = n > 0 ? String(Math.min(n, 3)) : 'VAI!';
    const scale = 1 + (1 - (G.countdown % 1)) * 0.25;
    ctx.save();
    ctx.translate(cw / 2, ch * 0.34);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 76px Inter, system-ui, sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = n > 0 ? '#ffd166' : '#4ade80';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  /* aviso de drift */
  if (Game.driftPop.life > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(Game.driftPop.life, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = '900 30px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5;
    ctx.strokeText(Game.driftPop.text, cw / 2, ch * 0.22);
    ctx.fillText(Game.driftPop.text, cw / 2, ch * 0.22);
    ctx.restore();
  }
}

/* ---------------- HUD ---------------- */
const el = id => document.getElementById(id);
let hudAcc = 0;

function updateHudStatic() {
  el('hud-track').textContent = Game.trackDef.name;
  el('hud-mode').textContent = Game.mode === 'story'
    ? (Game.trackDef.gp || 'TEMPORADA').toUpperCase()
    : (Game.mode === 'race' ? 'CORRIDA' : (Game.mode === 'time' ? 'CONTRA-RELÓGIO' : 'DRIFT'));
  const disputa = Game.mode === 'race' || Game.mode === 'story';
  el('hud-pos-wrap').classList.toggle('hidden', !disputa);
  el('hud-lap-wrap').classList.toggle('hidden', Game.mode === 'drift');
  el('hud-best-wrap').classList.toggle('hidden', Game.mode === 'drift');
  el('hud-drift-wrap').classList.toggle('hidden', false);
  el('btn-gas').classList.toggle('hidden', !!Game.settings.autoGas);
}

function hudTick(dt) {
  const G = Game;
  if (!G.player || (G.state !== 'racing' && G.state !== 'countdown' && G.state !== 'over')) return;
  if (G.toast.life > 0) G.toast.life -= dt;
  if (G.driftPop.life > 0) G.driftPop.life -= dt;

  const p = G.player;
  if (p.driftTimer > 0.4) {
    G.driftPop.text = 'DRIFT x' + p.driftCombo.toFixed(1) + '  +' + Math.round(p.driftBank * p.driftCombo);
    G.driftPop.life = 0.5;
  }

  hudAcc += dt;
  if (hudAcc < 0.08) return;
  hudAcc = 0;

  const r = rec(G.trackDef.id);
  el('hud-speed').textContent = Math.round(p.speed * 0.62);
  el('hud-lap').textContent = Math.min(p.lap + 1, G.totalLaps) + (G.mode === 'race' ? '/' + G.totalLaps : '');
  el('hud-time').textContent = G.mode === 'drift'
    ? Math.max(0, G.driftTimeLeft).toFixed(1) + 's'
    : fmtTime(p.lapStart ? (G.raceTime - p.lapStart) : G.raceTime);
  el('hud-best').textContent = fmtTime(p.bestLap || r.best);
  el('hud-drift').textContent = (p.driftScore + Math.round(p.driftBank * p.driftCombo)).toLocaleString('pt-BR');

  if (G.mode === 'race' || G.mode === 'story') {
    const sorted = G.cars.slice().sort((a, b) => b.progress() - a.progress());
    el('hud-pos').textContent = (sorted.indexOf(p) + 1) + '/' + G.cars.length;
  }

  const t = el('toast');
  t.textContent = G.toast.text;
  t.classList.toggle('show', G.toast.life > 0);
}

function showToast(text, life) { Game.toast.text = text; Game.toast.life = life; }

/* ---------------- telas ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  const playing = id === null;
  document.getElementById('hud').classList.toggle('hidden', !playing);
  document.getElementById('touch').classList.toggle('hidden', !playing);
  document.body.classList.toggle('menu-open', !playing);
}

function togglePause() {
  if (Game.state === 'racing' || Game.state === 'countdown') {
    Game.state = 'paused';
    showScreen('screen-pause');
    Sound.updateEngine(0, 0, 0, false);
  } else if (Game.state === 'paused') {
    Game.state = Game.countdown > 0 ? 'countdown' : 'racing';
    showScreen(null);
    last = performance.now();
  }
}

function quitToMenu() {
  Game.state = 'menu';
  const b = el('btn-season-abandon');
  if (b) { delete b.dataset.armed; b.textContent = 'Abandonar temporada'; }
  document.body.classList.remove('playing');
  Sound.updateEngine(0, 0, 0, false);
  showScreen('screen-menu');
  refreshMenu();
}

function showResults(newDrift) {
  const G = Game, p = G.player;
  const box = el('results-body');
  const disputa = G.mode === 'race' || G.mode === 'story';
  let pos = 1;
  if (disputa) {
    const sorted = G.lastOrder || finishingOrder();
    pos = sorted.indexOf(p) + 1;
  }
  const r = rec(G.trackDef.id);
  const rows = [];
  if (disputa) rows.push(['Posição final', ordinal(pos) + ' de ' + G.cars.length]);
  if (G.mode === 'story') {
    const ganhos = (G.lastPoints && G.lastPoints[p.entry.id]) || 0;
    rows.push(['Pontos nesta etapa', '+' + ganhos]);
    rows.push(['No campeonato', ordinal(Season.playerPosition()) + ' · ' +
      Season.driverStandings().find(r => r.entry.id === Season.playerId()).points + ' pts']);
  }
  if (G.mode !== 'drift') {
    rows.push(['Tempo total', fmtTime(G.raceTime)]);
    rows.push(['Melhor volta', fmtTime(p.bestLap)]);
    rows.push(['Recorde da pista', fmtTime(r.best)]);
  }
  rows.push(['Pontos de drift', p.driftScore.toLocaleString('pt-BR') + (newDrift ? '  🏆' : '')]);
  rows.push(['Recorde de drift', (r.drift || 0).toLocaleString('pt-BR')]);

  el('results-title').textContent = disputa
    ? (pos === 1 ? 'VITÓRIA!' : ordinal(pos) + ' lugar')
    : (G.mode === 'drift' ? 'Tempo esgotado' : 'Sessão encerrada');
  el('results-sub').textContent = (G.mode === 'story' ? G.trackDef.gp + ' · ' : G.trackDef.name + ' · ')
    + teamById(G.teamId).name;
  box.innerHTML = rows.map(x => '<div class="row"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join('');

  /* no modo história, a classificação completa da etapa */
  const cls = el('results-class');
  cls.classList.toggle('hidden', G.mode !== 'story');
  if (G.mode === 'story' && G.lastOrder) {
    cls.innerHTML = G.lastOrder.map((c, i) => {
      const pts = (G.lastPoints && G.lastPoints[c.entry.id]) || 0;
      return '<div class="stand' + (c.isPlayer ? ' me' : '') + '">' +
        '<span class="pos">' + (i + 1) + '</span>' +
        '<i class="dot" style="background:' + c.entry.team.color + '"></i>' +
        '<span class="who">' + (c.isPlayer ? c.entry.realName + ' (você)' : c.name) +
        ' <em>' + c.entry.team.short + '</em></span>' +
        '<span class="pts">' + (pts ? '+' + pts : '—') + '</span></div>';
    }).join('');
  }

  el('btn-results-again').textContent = G.mode === 'story' ? 'Continuar' : 'Correr de novo';
  el('btn-results-menu').textContent = G.mode === 'story' ? 'Ver temporada' : 'Menu';
  showScreen('screen-results');
}

/* ---------------- modo história ---------------- */
function openStory() {
  if (Season.active()) { showSeason(); return; }
  Game.teamPickFor = 'story';
  el('car-title').textContent = 'Escolha sua equipe para a temporada';
  buildCarList();
  showScreen('screen-car');
}

function beginSeason(teamId) {
  Season.start(teamId, 0);
  Game.teamId = teamId;
  saveSettings();
  showSeason();
}

function showSeason() {
  renderSeason();
  showScreen('screen-season');
}

function renderSeason() {
  const d = Season.data;
  if (!d) { showScreen('screen-menu'); return; }
  const team = teamById(d.teamId);
  const acabou = Season.finished();

  el('season-title').textContent = acabou ? 'Temporada encerrada' : 'Temporada';
  el('season-sub').textContent = team.country + ' ' + team.name + ' · ' +
    (acabou ? Season.total() + ' etapas disputadas'
      : 'Etapa ' + (d.round + 1) + ' de ' + Season.total());
  el('season-pos').textContent = ordinal(Season.playerPosition());

  /* aba ativa */
  document.querySelectorAll('#screen-season .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === Game.seasonTab));

  const body = el('season-body');
  if (Game.seasonTab === 'cal') {
    let html = '';
    if (acabou) {
      const campeao = Season.driverStandings()[0];
      const eu = campeao.entry.id === Season.playerId();
      html += '<div class="champion"><div class="cup">' + (eu ? '🏆' : '🏁') + '</div>' +
        '<b>' + (eu ? 'Você é o campeão!' : campeao.entry.realName + ' é o campeão') + '</b>' +
        '<span>' + campeao.entry.team.name + ' · ' + campeao.points + ' pontos</span></div>';
    }
    html += Season.CALENDAR.map((id, i) => {
      const t = TRACK_DEFS.find(x => x.id === id);
      const feito = i < d.round;
      const agora = i === d.round;
      const r = d.rounds[i];
      return '<div class="round' + (feito ? ' done' : '') + (agora ? ' next' : '') + '">' +
        '<span class="round-n">' + (i + 1) + '</span>' +
        '<span class="round-info"><b>' + t.country + ' ' + t.gp + '</b>' +
        '<span>' + t.name + ' · ' + t.laps + ' voltas</span></span>' +
        '<span class="round-res">' + (r ? ordinal(r.playerPos) : (agora ? 'próxima' : '')) + '</span>' +
        '</div>';
    }).join('');
    body.innerHTML = html;
  } else if (Game.seasonTab === 'drv') {
    body.innerHTML = Season.driverStandings().map((r, i) =>
      '<div class="stand' + (r.entry.id === Season.playerId() ? ' me' : '') + '">' +
      '<span class="pos">' + (i + 1) + '</span>' +
      '<i class="dot" style="background:' + r.entry.team.color + '"></i>' +
      '<span class="who">' + r.entry.realName + ' <em>' + r.entry.team.short + '</em></span>' +
      '<span class="pts">' + r.points + '</span></div>').join('');
  } else {
    body.innerHTML = Season.teamStandings().map((r, i) =>
      '<div class="stand' + (r.team.id === d.teamId ? ' me' : '') + '">' +
      '<span class="pos">' + (i + 1) + '</span>' +
      '<i class="dot" style="background:' + r.team.color + '"></i>' +
      '<span class="who">' + r.team.country + ' ' + r.team.name + '</span>' +
      '<span class="pts">' + r.points + '</span></div>').join('');
  }

  const btn = el('btn-season-race');
  if (acabou) {
    btn.textContent = 'Nova temporada';
  } else {
    const t = Season.currentTrack();
    btn.textContent = 'Correr · ' + t.gp;
  }
}

function runSeasonRace() {
  if (Season.finished()) {
    Season.clear();
    openStory();
    return;
  }
  Game.mode = 'story';
  Game.trackDef = Season.currentTrack();
  Game.teamId = Season.data.teamId;
  startRace();
}

/* ---------------- menus ---------------- */
function refreshMenu() {
  el('menu-track').textContent = Game.trackDef.country + ' ' + Game.trackDef.name;
  const tm = teamById(Game.teamId);
  el('menu-car').textContent = tm.country + ' ' + tm.name;
  const r = rec(Game.trackDef.id);
  el('menu-record').textContent = r.best ? 'Recorde: ' + fmtTime(r.best) : 'Sem recorde ainda';
  const sb = el('btn-play-story');
  if (Season.active()) {
    sb.textContent = Season.finished()
      ? '🏆 Temporada encerrada'
      : '🏆 Continuar temporada · etapa ' + (Season.data.round + 1) + '/' + Season.total();
  } else {
    sb.textContent = '🏆 Modo História';
  }
}

function buildTrackList() {
  const wrap = el('track-list');
  wrap.innerHTML = '';
  TRACK_DEFS.forEach(def => {
    const r = Game.records[def.id] || {};
    const card = document.createElement('button');
    card.className = 'card' + (def.id === Game.trackDef.id ? ' active' : '');
    card.innerHTML =
      '<canvas class="thumb" width="150" height="110"></canvas>' +
      '<div class="card-info">' +
      '<h3>' + def.country + ' ' + def.name + '</h3>' +
      '<p>' + def.sub + '</p>' +
      '<p class="meta">' + def.laps + ' voltas · ' + '★'.repeat(def.difficulty) + '<span class="dim">' +
      (r.best ? ' · ' + fmtTime(r.best) : '') + '</span></p>' +
      '</div>';
    card.onclick = () => {
      Game.trackDef = def;
      buildTrackList();
      refreshMenu();
      Sound.blip(660, 0.06, 'triangle', 0.12);
    };
    wrap.appendChild(card);
    drawThumb(card.querySelector('.thumb'), def);
  });
}

function drawThumb(cv, def) {
  const t = buildTrack(def);
  const c = cv.getContext('2d');
  const b = t.bounds;
  const s = Math.min(cv.width / b.w, cv.height / b.h) * 0.9;
  c.fillStyle = def.urban ? '#3a4150' : '#2f5c2c';
  c.fillRect(0, 0, cv.width, cv.height);
  c.save();
  c.translate((cv.width - b.w * s) / 2, (cv.height - b.h * s) / 2);
  c.scale(s, s); c.translate(-b.x, -b.y);
  c.lineJoin = c.lineCap = 'round';
  centerPath(c, t);
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = t.width + 14; c.stroke();
  centerPath(c, t);
  c.strokeStyle = '#7d838c'; c.lineWidth = t.width; c.stroke();
  const p = t.pts[0];
  c.fillStyle = '#fff';
  c.beginPath(); c.arc(p.x, p.y, t.width * 0.55, 0, TAU); c.fill();
  c.restore();
}

function buildCarList() {
  const wrap = el('car-list');
  wrap.innerHTML = '';
  TEAMS.forEach(team => {
    const card = document.createElement('button');
    card.className = 'card car-card' + (team.id === Game.teamId ? ' active' : '');
    const bars = ['Potência', 'Freio', 'Drift'].map((label, i) =>
      '<div class="bar"><span>' + label + '</span><i>' +
      '<u style="width:' + (team.stats[i] / 5 * 100) + '%"></u></i></div>').join('');
    card.innerHTML =
      '<canvas class="thumb car-thumb" width="160" height="120"></canvas>' +
      '<div class="card-info"><h3>' + team.country + ' ' + team.name + '</h3>' +
      '<p>' + team.drivers.map(d => d.name).join(' · ') + '</p>' + bars + '</div>';
    card.onclick = () => {
      Sound.blip(660, 0.06, 'triangle', 0.12);
      if (Game.teamPickFor === 'story') { beginSeason(team.id); return; }
      Game.teamId = team.id; saveSettings();
      buildCarList(); refreshMenu();
    };
    wrap.appendChild(card);
    drawCarThumb(card.querySelector('.thumb'), team);
  });
}

/* miniatura do monoposto com as cores da equipe */
function drawCarThumb(cv, team) {
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#252a33'); g.addColorStop(1, '#1a1e25');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  c.save();
  c.translate(cv.width / 2, cv.height / 2);
  c.scale(2.5, 2.5);
  c.rotate(-Math.PI / 2);
  drawCar(c, {
    x: 0, y: 0, angle: 0, steerAngle: 0.3, hitTimer: 0, brakeGlow: 0,
    spec: { color: team.color, accent: team.color2, wing: team.wing }
  });
  c.restore();
}

function setDifficultyLabel(i) {
  const d = DIFFICULTIES[clamp(i, 0, DIFFICULTIES.length - 1)];
  el('set-difficulty-val').textContent = d.name;
  el('set-difficulty-desc').textContent = d.desc;
}

function buildSettings() {
  const s = Game.settings;
  el('set-autogas').checked = s.autoGas;
  el('set-assist').checked = s.assist;
  el('set-sound').checked = s.sound;
  el('set-opponents').value = s.opponents;
  el('set-opponents-val').textContent = s.opponents;
  el('set-difficulty').value = s.difficulty;
  setDifficultyLabel(s.difficulty);
  el('set-laps').value = s.laps;
  el('set-laps-val').textContent = s.laps ? s.laps : 'padrão';
}

/* ---------------- ligações da interface ---------------- */
function wireUI() {
  el('btn-play-story').onclick = openStory;
  el('btn-play-race').onclick = () => { Game.mode = 'race'; startRace(); };
  el('btn-play-time').onclick = () => { Game.mode = 'time'; startRace(); };
  el('btn-play-drift').onclick = () => { Game.mode = 'drift'; startRace(); };

  el('btn-open-tracks').onclick = () => { buildTrackList(); showScreen('screen-track'); };
  el('btn-open-cars').onclick = () => {
    Game.teamPickFor = 'quick';
    el('car-title').textContent = 'Escolha a equipe';
    buildCarList(); showScreen('screen-car');
  };
  el('btn-open-settings').onclick = () => { buildSettings(); showScreen('screen-settings'); };
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { refreshMenu(); showScreen('screen-menu'); });

  el('btn-pause').onclick = togglePause;
  el('btn-resume').onclick = togglePause;
  el('btn-restart').onclick = startRace;
  el('btn-quit').onclick = quitToMenu;
  el('btn-results-again').onclick = () => {
    if (Game.mode === 'story') { document.body.classList.remove('playing'); showSeason(); }
    else startRace();
  };
  el('btn-results-menu').onclick = () => {
    if (Game.mode === 'story') { document.body.classList.remove('playing'); showSeason(); }
    else quitToMenu();
  };

  el('btn-season-race').onclick = runSeasonRace;
  el('btn-season-quit').onclick = quitToMenu;
  el('btn-season-abandon').onclick = () => {
    if (el('btn-season-abandon').dataset.armed) {
      Season.clear(); quitToMenu();
    } else {
      el('btn-season-abandon').dataset.armed = '1';
      el('btn-season-abandon').textContent = 'Tem certeza? Toque de novo';
    }
  };
  document.querySelectorAll('#screen-season .tab').forEach(t => {
    t.onclick = () => { Game.seasonTab = t.dataset.tab; renderSeason(); };
  });

  el('set-autogas').onchange = e => { Game.settings.autoGas = e.target.checked; saveSettings(); updateHudStatic(); };
  el('set-assist').onchange = e => {
    Game.settings.assist = e.target.checked; saveSettings();
    if (Game.player) Game.player.assist = e.target.checked ? 0.6 : 0.12;
  };
  el('set-sound').onchange = e => { Game.settings.sound = e.target.checked; Sound.setMuted(!e.target.checked); saveSettings(); };
  el('set-opponents').oninput = e => {
    Game.settings.opponents = +e.target.value;
    el('set-opponents-val').textContent = e.target.value; saveSettings();
  };
  el('set-difficulty').oninput = e => {
    Game.settings.difficulty = +e.target.value;
    setDifficultyLabel(+e.target.value); saveSettings();
  };
  el('set-laps').oninput = e => {
    Game.settings.laps = +e.target.value;
    el('set-laps-val').textContent = +e.target.value ? e.target.value : 'padrão'; saveSettings();
  };
  el('btn-reset-records').onclick = () => {
    Game.records = {}; saveRecords(); refreshMenu(); buildTrackList();
    showToastMenu('Recordes apagados');
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state === 'racing') togglePause();
  });
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => { Sound.init(); Sound.setMuted(!Game.settings.sound); }, { once: true }));
}

function showToastMenu(msg) {
  const t = el('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---------------- som por quadro ---------------- */
setInterval(() => {
  const p = Game.player;
  const playing = (Game.state === 'racing' || Game.state === 'countdown');
  if (!p) { Sound.updateEngine(0, 0, 0, false); return; }
  const rpm = clamp(p.speed / p.spec.top, 0, 1) * 0.75 + (playerInput().throttle * 0.25);
  Sound.updateEngine(rpm, playerInput().throttle, Math.abs(p.slip) * (p.speed > 60 ? 1 : 0), playing);
}, 60);

/* ---------------- início ---------------- */
function boot() {
  loadStore();
  Season.load();
  resize();
  bindTouch();
  wireUI();
  Sound.muted = !Game.settings.sound;
  prepareTrack(Game.trackDef);
  refreshMenu();
  showScreen('screen-menu');
  requestAnimationFrame(frame);

  const noSW = window.__STANDALONE__ || location.search.indexOf('nosw') >= 0 ||
    localStorage.getItem('gc_nosw');
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !noSW) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
}
if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot);

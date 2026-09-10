/* ============================================================
   audio.js - som sintetizado (nenhum arquivo, funciona offline)
   ============================================================ */
'use strict';

const Sound = {
  ctx: null, ready: false, muted: false,
  engine: null, skid: null, master: null,

  init: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    /* --- motor: duas ondas dente-de-serra + filtro --- */
    const eg = ctx.createGain(); eg.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 3;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 30;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(filt); o2.connect(g2); g2.connect(filt);
    filt.connect(eg); eg.connect(this.master);
    o1.start(); o2.start();
    this.engine = { o1: o1, o2: o2, gain: eg, filter: filt };

    /* --- derrapagem: ruído branco filtrado --- */
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.9;
    const sg = ctx.createGain(); sg.gain.value = 0;
    src.connect(bp); bp.connect(sg); sg.connect(this.master);
    src.start();
    this.skid = { gain: sg, filter: bp };

    this.ready = true;
  },

  setMuted: function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  },

  /* chamado a cada quadro com o estado do carro do jogador */
  updateEngine: function (rpm, load, slip, playing) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const freq = 48 + rpm * 300;
    this.engine.o1.frequency.setTargetAtTime(freq, t, 0.05);
    this.engine.o2.frequency.setTargetAtTime(freq * 0.5, t, 0.05);
    this.engine.filter.frequency.setTargetAtTime(500 + rpm * 2600 + load * 700, t, 0.06);
    this.engine.gain.gain.setTargetAtTime(playing ? (0.045 + load * 0.055) : 0, t, 0.08);
    this.skid.gain.gain.setTargetAtTime(playing ? clamp(slip * 0.16, 0, 0.11) : 0, t, 0.05);
    this.skid.filter.frequency.setTargetAtTime(1600 + slip * 1800, t, 0.1);
  },

  blip: function (freq, dur, type, vol) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.15));
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + (dur || 0.15) + 0.05);
  },

  crash: function () {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.35;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t);
  }
};

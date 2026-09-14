/* ============================================================
   season.js - campeonato do modo história
   Guarda a pontuação de todos os 20 pilotos, decide a ordem de
   largada e monta as classificações. Tudo salvo no aparelho.
   ============================================================ */
'use strict';

const Season = {
  POINTS: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  CALENDAR: ['monza', 'spa', 'silverstone', 'monaco',
    'zandvoort', 'interlagos', 'arena'],
  data: null,

  load: function () {
    try { this.data = JSON.parse(localStorage.getItem('gc_season') || 'null'); }
    catch (e) { this.data = null; }
    return this.data;
  },
  save: function () {
    try { localStorage.setItem('gc_season', JSON.stringify(this.data)); } catch (e) { }
  },
  clear: function () {
    this.data = null;
    try { localStorage.removeItem('gc_season'); } catch (e) { }
  },

  start: function (teamId, driverIndex) {
    const pts = {};
    for (const t of TEAMS) {
      for (let d = 0; d < t.drivers.length; d++) pts[t.id + '-' + d] = 0;
    }
    this.data = {
      teamId: teamId, driverIndex: driverIndex || 0,
      round: 0, points: pts, rounds: []
    };
    this.save();
    return this.data;
  },

  active: function () { return !!this.data; },

  /* ---- classificação ----
     O jogador anda a volta; os adversários têm o tempo gerado a partir da
     melhor volta possível da pista, dividida pelo ritmo da dupla
     nível-de-dificuldade × força-da-equipe. */
  qualiFeita: function () { return !!(this.data && this.data.grid); },

  tempoAdversario: function (entry, def, difficulty) {
    const ref = def.refLap || 25000;
    const ritmo = DIFFICULTIES[clamp(difficulty | 0, 0, DIFFICULTIES.length - 1)].base * entry.team.tier;
    const ruido = 1 + (Math.random() - 0.5) * 0.028;
    return ref / ritmo * ruido;
  },

  /* tempoJogador em ms, ou null se ele não marcou volta válida */
  aplicaQuali: function (tempoJogador, def, difficulty) {
    const eu = this.playerId();
    const linhas = this.entries().map(e => ({
      entry: e,
      tempo: e.id === eu ? tempoJogador : this.tempoAdversario(e, def, difficulty)
    }));
    linhas.sort((a, b) => {
      if (a.tempo == null) return 1;
      if (b.tempo == null) return -1;
      return a.tempo - b.tempo;
    });
    this.data.grid = linhas.map(l => l.entry.id);
    this.data.quali = linhas.map(l => ({ id: l.entry.id, tempo: l.tempo }));
    this.save();
    return linhas;
  },

  /* grid da corrida: o da classificação se houver, senão o campeonato */
  gridDaCorrida: function () {
    if (!this.data.grid) return this.gridOrder();
    const porId = {};
    for (const e of this.entries()) porId[e.id] = e;
    return this.data.grid.map(id => porId[id]).filter(Boolean);
  },

  limpaQuali: function () {
    delete this.data.grid; delete this.data.quali; this.save();
  },
  finished: function () { return this.data && this.data.round >= this.CALENDAR.length; },
  total: function () { return this.CALENDAR.length; },

  trackOfRound: function (r) {
    const id = this.CALENDAR[r];
    return TRACK_DEFS.find(t => t.id === id);
  },
  currentTrack: function () { return this.trackOfRound(this.data.round); },

  entries: function () { return allEntries(this.data.teamId, this.data.driverIndex); },
  playerId: function () { return this.data.teamId + '-' + this.data.driverIndex; },

  /* ordem de largada = classificação do campeonato (líder na pole).
     Na primeira etapa, ainda sem pontos, vale a força da equipe. */
  gridOrder: function () {
    const pts = this.data.points;
    const es = this.entries();
    es.sort((a, b) => ((pts[b.id] || 0) - (pts[a.id] || 0)) || (b.team.tier - a.team.tier));
    return es;
  },

  /* orderIds = ids na ordem de chegada */
  applyResult: function (orderIds) {
    const gained = {};
    orderIds.forEach((id, i) => {
      const p = i < this.POINTS.length ? this.POINTS[i] : 0;
      gained[id] = p;
      this.data.points[id] = (this.data.points[id] || 0) + p;
    });
    this.data.rounds.push({
      track: this.CALENDAR[this.data.round],
      order: orderIds.slice(0, 10),
      playerPos: orderIds.indexOf(this.playerId()) + 1
    });
    this.data.round++;
    delete this.data.grid;
    delete this.data.quali;
    this.save();
    return gained;
  },

  driverStandings: function () {
    const pts = this.data.points;
    return this.entries()
      .map(e => ({ entry: e, points: pts[e.id] || 0 }))
      .sort((a, b) => (b.points - a.points) || (b.entry.team.tier - a.entry.team.tier));
  },

  teamStandings: function () {
    const pts = this.data.points;
    return TEAMS
      .map(t => ({
        team: t,
        points: t.drivers.reduce((s, d, i) => s + (pts[t.id + '-' + i] || 0), 0)
      }))
      .sort((a, b) => (b.points - a.points) || (b.team.tier - a.team.tier));
  },

  playerPosition: function () {
    const st = this.driverStandings();
    return st.findIndex(r => r.entry.id === this.playerId()) + 1;
  }
};

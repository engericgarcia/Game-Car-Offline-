/* ============================================================
   teams.js - equipes, pilotos e desempenho de cada carro
   As equipes são inspiradas nas da F1 (cores e caráter), com
   nomes próprios para o projeto. Trocar por outros nomes é só
   editar este array.
   ============================================================ */
'use strict';

/* color  = cor principal da carroceria
   color2 = faixa/detalhe
   wing    = asas e bico
   tier    = ritmo base da IA (1.00 = equipe de ponta)
   stats   = [potência, freio, drift] de 1 a 5, só para exibir */
const TEAMS = [
  {
    id: 'rossa', name: 'Scuderia Rossa', short: 'ROS', country: '🇮🇹',
    color: '#d81e26', color2: '#f4f6f8', wing: '#17191e',
    engine: 596, top: 422, grip: 0.838, driftGrip: 0.968, turn: 3.04, brake: 862,
    tier: 1.00, stats: [5, 4, 3],
    drivers: [{ name: 'L. Bianchi', num: 7 }, { name: 'F. Moretti', num: 8 }]
  },
  {
    id: 'prata', name: 'Silberpfeil', short: 'SIL', country: '🇩🇪',
    color: '#b9c3cc', color2: '#00b3a4', wing: '#1b1f26',
    engine: 584, top: 418, grip: 0.826, driftGrip: 0.962, turn: 3.12, brake: 884,
    tier: 0.995, stats: [4, 5, 3],
    drivers: [{ name: 'K. Halvorsen', num: 12 }, { name: 'D. Vogel', num: 30 }]
  },
  {
    id: 'papaia', name: 'Papaya Racing', short: 'PAP', country: '🇬🇧',
    color: '#ff7a18', color2: '#12305e', wing: '#1b1f26',
    engine: 588, top: 420, grip: 0.834, driftGrip: 0.972, turn: 3.10, brake: 868,
    tier: 0.998, stats: [4, 4, 4],
    drivers: [{ name: 'O. Pearce', num: 4 }, { name: 'R. Santos', num: 81 }]
  },
  {
    id: 'touro', name: 'Touro Azul', short: 'TOU', country: '🇦🇹',
    color: '#123a7a', color2: '#e4032e', wing: '#f2c200',
    engine: 600, top: 424, grip: 0.842, driftGrip: 0.970, turn: 2.98, brake: 856,
    tier: 0.997, stats: [5, 4, 3],
    drivers: [{ name: 'M. Steiner', num: 1 }, { name: 'A. Novak', num: 11 }]
  },
  {
    id: 'alpino', name: 'Verde Alpino', short: 'ALP', country: '🇬🇧',
    color: '#00594f', color2: '#d3b464', wing: '#17191e',
    engine: 572, top: 412, grip: 0.846, driftGrip: 0.974, turn: 3.06, brake: 846,
    tier: 0.985, stats: [3, 3, 4],
    drivers: [{ name: 'G. Ashford', num: 14 }, { name: 'P. Lindqvist', num: 18 }]
  },
  {
    id: 'bleu', name: 'Bleu Alpin', short: 'BLE', country: '🇫🇷',
    color: '#1350e0', color2: '#ef4c8a', wing: '#1b1f26',
    engine: 566, top: 408, grip: 0.850, driftGrip: 0.976, turn: 3.14, brake: 838,
    tier: 0.980, stats: [3, 3, 4],
    drivers: [{ name: 'É. Lambert', num: 10 }, { name: 'N. Perrin', num: 31 }]
  },
  {
    id: 'azzurro', name: 'Azzurro Lab', short: 'AZZ', country: '🇮🇹',
    color: '#2f6fd0', color2: '#e8edf3', wing: '#17191e',
    engine: 570, top: 410, grip: 0.848, driftGrip: 0.978, turn: 3.16, brake: 842,
    tier: 0.978, stats: [3, 3, 5],
    drivers: [{ name: 'S. Ricci', num: 22 }, { name: 'Y. Tanaka', num: 40 }]
  },
  {
    id: 'nero', name: 'Nero Corsa', short: 'NER', country: '🇺🇸',
    color: '#2b3038', color2: '#e8ecf2', wing: '#d81e26',
    engine: 562, top: 406, grip: 0.854, driftGrip: 0.980, turn: 3.00, brake: 834,
    tier: 0.972, stats: [2, 2, 4],
    drivers: [{ name: 'C. Brandt', num: 20 }, { name: 'W. Hayes', num: 27 }]
  },
  {
    id: 'albion', name: 'Albion GP', short: 'ALB', country: '🇬🇧',
    color: '#0b2c6b', color2: '#40b4ff', wing: '#e8ecf2',
    engine: 558, top: 404, grip: 0.856, driftGrip: 0.974, turn: 3.08, brake: 830,
    tier: 0.968, stats: [2, 2, 3],
    drivers: [{ name: 'T. Whitfield', num: 23 }, { name: 'J. Cole', num: 2 }]
  },
  {
    id: 'lima', name: 'Verde Lima', short: 'LIM', country: '🇨🇭',
    color: '#8cd600', color2: '#17191e', wing: '#17191e',
    engine: 554, top: 402, grip: 0.858, driftGrip: 0.982, turn: 3.02, brake: 826,
    tier: 0.964, stats: [2, 2, 5],
    drivers: [{ name: 'V. Keller', num: 24 }, { name: 'B. Okonkwo', num: 77 }]
  }
];

function teamById(id) { return TEAMS.find(t => t.id === id) || TEAMS[0]; }

/* Um carro no grid = equipe + um dos dois pilotos dela. */
function makeEntry(team, driverIndex, isPlayer) {
  const d = team.drivers[driverIndex];
  return {
    id: team.id + '-' + driverIndex,
    team: team, driverIndex: driverIndex,
    name: isPlayer ? 'VOCÊ' : d.name,
    realName: d.name, num: d.num, isPlayer: !!isPlayer,
    /* o Car usa estes campos diretamente */
    color: team.color, accent: team.color2, wing: team.wing,
    engine: team.engine, top: team.top, grip: team.grip,
    driftGrip: team.driftGrip, turn: team.turn, brake: team.brake
  };
}

/* Grid completo: todas as equipes, dois carros cada. */
function allEntries(playerTeamId, playerDriverIndex) {
  const out = [];
  for (const t of TEAMS) {
    for (let d = 0; d < t.drivers.length; d++) {
      out.push(makeEntry(t, d, t.id === playerTeamId && d === playerDriverIndex));
    }
  }
  return out;
}

/* Hong Kong mahjong, four seats, one wall. You are seat 0; the other three are bots
   that play tile efficiency off the same engine the coach uses. */
(function (root, E) {
'use strict';

var HUMAN = 0;
var WIND = ['東', '南', '西', '北'];

function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seatWind(g, seat) { return (seat - g.dealer + 4) % 4; }
function nextSeat(s) { return (s + 1) % 4; }
/* the only seat allowed to chow a discard is the one to the discarder's right */
function isLeftOf(g, seat, from) { return nextSeat(from) === seat; }

function ctxFor(g, seat, opts) {
  var s = g.seats[seat];
  return {
    seat: seatWind(g, seat), round: g.round,
    selfDraw: !!(opts && opts.selfDraw),
    lastTile: !!(opts && opts.lastTile),
    kongDraw: !!(opts && opts.kongDraw),
    concealed: s.melds.every(function (m) { return m.concealed; }),
    flowers: 0, melds: s.melds
  };
}
function handSize(seat) { return 14 - 3 * seat.melds.length; }
function shantenOf(g, seat) {
  var s = g.seats[seat];
  return E.shanten(s.counts, ctxFor(g, seat).concealed, s.melds.length);
}

function newGame(opts) {
  opts = opts || {};
  var rand = rng(opts.seed === undefined ? (Math.random() * 1e9) | 0 : opts.seed);
  var wall = [], i, k;
  for (i = 0; i < 34; i++) for (k = 0; k < 4; k++) wall.push(i);
  for (i = wall.length - 1; i > 0; i--) {
    var j = Math.floor(rand() * (i + 1)), tmp = wall[i];
    wall[i] = wall[j]; wall[j] = tmp;
  }
  var dealer = opts.dealer === undefined ? 0 : opts.dealer;
  var g = {
    wall: wall, dealer: dealer, round: opts.round === undefined ? 0 : opts.round,
    minFaan: opts.minFaan === undefined ? 0 : opts.minFaan,
    seats: [0, 1, 2, 3].map(function () {
      return { counts: new Array(34).fill(0), melds: [], discards: [] };
    }),
    turn: dealer, phase: 'discard', lastDiscard: null, offer: null,
    passed: [], log: [], result: null, rand: rand
  };
  for (k = 0; k < 13; k++) for (i = 0; i < 4; i++) g.seats[i].counts[g.wall.shift()]++;
  g.drawn = g.wall.shift();
  g.seats[dealer].counts[g.drawn]++;
  say(g, WIND[seatWind(g, dealer)] + ' deals');
  return g;
}

function say(g, text, seat) { g.log.push({ text: text, seat: seat }); }

/* ---------- what a seat may claim ---------- */
function winWith(g, seat, tile, opts) {
  var s = g.seats[seat], c = s.counts.slice();
  if (tile !== undefined && tile !== null) c[tile]++;
  if (E.total(c) !== handSize(s)) return null;
  var sc = E.score(c, ctxFor(g, seat, opts));
  if (!sc || sc.faan < g.minFaan) return null;
  return sc;
}

function claimsFor(g, seat, tile, from) {
  var s = g.seats[seat], out = [];
  if (seat === from) return out;
  var win = winWith(g, seat, tile);
  if (win) out.push({ kind: 'win', tile: tile, score: win });
  if (s.counts[tile] >= 3) out.push({ kind: 'kong', tile: tile });
  if (s.counts[tile] >= 2) out.push({ kind: 'pung', tile: tile });
  if (isLeftOf(g, seat, from) && !E.isHonor(tile)) {
    var r = E.rankOf(tile);
    [-2, -1, 0].forEach(function (off) {
      var base = tile + off;
      if (r + off < 1 || r + off + 2 > 9) return;
      var a = base, b = base + 1, cc = base + 2;
      if ([a, b, cc].every(function (t) { return t === tile || s.counts[t] > 0; })) {
        out.push({ kind: 'chow', tile: base, used: [a, b, cc].filter(function (t) { return t !== tile; }) });
      }
    });
  }
  return out;
}

/* a claim is worth making if it moves the hand forward */
function claimHelps(g, seat, claim) {
  if (claim.kind === 'win') return true;
  var s = g.seats[seat], before = shantenOf(g, seat);
  var c = s.counts.slice();
  if (claim.kind === 'chow') claim.used.forEach(function (t) { c[t]--; });
  else c[claim.tile] -= claim.kind === 'kong' ? 3 : 2;
  var after = E.shanten(c, false, s.melds.length + 1);
  return claim.kind === 'kong' ? after <= before : after < before;
}

function applyClaim(g, seat, claim, from) {
  var s = g.seats[seat];
  g.seats[from].discards.pop();
  if (claim.kind === 'chow') claim.used.forEach(function (t) { s.counts[t]--; });
  else s.counts[claim.tile] -= claim.kind === 'kong' ? 3 : 2;
  s.melds.push({ type: claim.kind, tile: claim.tile, concealed: false });
  say(g, WIND[seatWind(g, seat)] + ' ' + ({ chow: '上', pung: '碰', kong: '槓' })[claim.kind] +
    ' ' + E.tileName(claim.tile), seat);
  g.lastDiscard = null; g.passed = []; g.offer = null; g.turn = seat;
  if (claim.kind === 'kong') { drawTile(g, seat, true); } else { g.drawn = null; g.phase = 'discard'; }
}

/* winning on a discard takes that tile out of the pond and into the hand */
function finish(g, seat, score, how, d) {
  if (d) {
    g.seats[seat].counts[d.tile]++;
    g.seats[d.from].discards.pop();
  }
  g.phase = 'over';
  g.lastDiscard = null; g.offer = null; g.drawn = d ? d.tile : g.drawn;
  g.result = { seat: seat, score: score, how: how, units: score.units,
    from: d ? d.from : null, tile: d ? d.tile : null };
  say(g, WIND[seatWind(g, seat)] + ' 食糊 — ' + score.faan + ' faan', seat);
}

function drawTile(g, seat, afterKong) {
  if (!g.wall.length) {
    g.phase = 'over'; g.result = { seat: null, how: 'draw' };
    say(g, '流局 — wall exhausted, nobody wins');
    return;
  }
  g.drawn = g.wall.shift();
  g.seats[seat].counts[g.drawn]++;
  g.turn = seat; g.phase = 'discard'; g.lastTile = g.wall.length === 0;
  g.kongDraw = !!afterKong;
}

/* ---------- reading the table: who is dangerous, and which tile feeds them ----------
   HK has no furiten, so a tile an opponent threw is not provably safe — only likelier
   to be safe. Everything here is an estimate from what is face-up. */
var DRAGONS = [31, 32, 33];

/* copies of a tile already accounted for: every pond, every laid-down set, your own rack */
function seen(g, from, tile) {
  var n = g.seats[from].counts[tile];
  g.seats.forEach(function (s) {
    s.discards.forEach(function (t) { if (t === tile) n++; });
    s.melds.forEach(function (m) {
      E.meldTiles(m).forEach(function (t) { if (t === tile) n++; });
    });
  });
  return Math.min(4, n);
}

/* a seat that stops throwing one suit while throwing the other two is chasing a flush */
function flushSuit(g, seat) {
  var s = g.seats[seat], d = [0, 0, 0], i;
  if (s.discards.length < 5) return null;
  s.discards.forEach(function (t) { if (!E.isHonor(t)) d[E.suitOf(t)]++; });
  var meldSuits = {};
  s.melds.forEach(function (m) { if (!E.isHonor(m.tile)) meldSuits[E.suitOf(m.tile)] = 1; });
  var keys = Object.keys(meldSuits);
  for (i = 0; i < 3; i++) {
    // both other suits must be in their pond: one untouched suit among three proves nothing
    if (d[i] === 0 && d[(i + 1) % 3] > 0 && d[(i + 2) % 3] > 0 &&
        d[(i + 1) % 3] + d[(i + 2) % 3] >= 4 && (!keys.length || meldSuits[i])) return i;
  }
  return null;
}

/* 0 = harmless, 1 = almost certainly tenpai on something big */
function threat(g, seat) {
  var s = g.seats[seat], t = s.melds.length * 0.2;
  s.melds.forEach(function (m) {
    if (DRAGONS.indexOf(m.tile) >= 0) t += 0.12;
    if (m.tile === 27 + seatWind(g, seat) || m.tile === 27 + g.round) t += 0.1;
  });
  if (flushSuit(g, seat) !== null) t += 0.2;
  t += (1 - g.wall.length / 83) * 0.25;
  return Math.max(0, Math.min(1, t));
}

/* 0 = they can hardly use it, 1 = it finishes a lot of hands */
function danger(g, from, tile, seat) {
  var s = g.seats[seat], d;
  if (E.isHonor(tile)) d = 0.3;
  else d = 0.35 + 0.1 * (4 - Math.abs(5 - E.rankOf(tile)));
  if (s.discards.indexOf(tile) >= 0) d *= 0.35;
  var flush = flushSuit(g, seat);
  if (flush !== null) {
    d *= (E.isHonor(tile) || E.suitOf(tile) === flush) ? 1.6 : 0.25;
  }
  d *= 0.4 + (4 - seen(g, from, tile)) / 4 * 0.6;
  return Math.max(0, Math.min(1, d));
}

var RISK_WORD = [[0.08, 'safe'], [0.18, 'fair'], [0.32, 'live'], [1, 'hot']];
/* the worst case across the three opponents */
function risk(g, from, tile) {
  var worst = { score: 0, seat: null, danger: 0, threat: 0 };
  [0, 1, 2, 3].forEach(function (s) {
    if (s === from) return;
    var th = threat(g, s), dg = danger(g, from, tile, s), sc = th * dg;
    if (sc > worst.score) worst = { score: sc, seat: s, danger: dg, threat: th };
  });
  worst.word = RISK_WORD.find(function (r) { return worst.score <= r[0]; })[1];
  if (worst.seat !== null) {
    var fs = flushSuit(g, worst.seat), bits = [];
    if (g.seats[worst.seat].melds.length) bits.push(g.seats[worst.seat].melds.length + ' set(s) down');
    if (fs !== null) bits.push('has stopped throwing ' + E.SUIT_CH[fs]);
    if (g.seats[worst.seat].discards.indexOf(tile) >= 0) bits.push('threw this tile themselves');
    worst.why = HKG_WIND[seatWind(g, worst.seat)] + (bits.length ? ' — ' + bits.join(', ') : '');
  }
  return worst;
}

/* ---------- bots ---------- */
/* speed when nobody is scary; when someone is, pay shanten for a quiet tile */
function botDiscard(g, seat) {
  var s = g.seats[seat];
  var ranked = E.discards(s.counts, ctxFor(g, seat));
  if (!ranked.length) return E.countsToTiles(s.counts)[0];
  var best = ranked[0];
  var push = best.shanten <= 0 ? 0.55 : best.shanten === 1 ? 0.85 : 1.15;
  var scored = ranked.map(function (d) {
    var loss = (d.shanten - best.shanten) + (best.live - d.live) / Math.max(1, best.live) * 0.5;
    return { tile: d.tile, cost: loss + risk(g, seat, d.tile).score * push * 2.2 };
  });
  scored.sort(function (a, b) { return a.cost - b.cost || a.tile - b.tile; });
  return scored[0].tile;
}

/* ---------- one beat of play ---------- */
function step(g) {
  if (g.phase === 'over') return null;

  if (g.phase === 'discard') {
    var seat = g.turn;
    var self = winWith(g, seat, null, { selfDraw: true, lastTile: g.lastTile, kongDraw: g.kongDraw });
    if (self) {
      if (seat === HUMAN) { g.offer = { seat: HUMAN, claims: [{ kind: 'win', tile: null, score: self }], selfDraw: true }; return { wait: 'offer' }; }
      finish(g, seat, self, 'selfDraw'); return { event: 'win' };
    }
    if (seat === HUMAN) {
      var kongs = [];
      for (var t = 0; t < 34; t++) if (g.seats[HUMAN].counts[t] >= 4) kongs.push({ kind: 'concealedKong', tile: t });
      g.selfKongs = kongs;
      return { wait: 'discard' };
    }
    discard(g, seat, botDiscard(g, seat));
    return { event: 'discard', seat: seat, tile: g.lastDiscard.tile };
  }

  if (g.phase === 'claim') {
    var d = g.lastDiscard, order = [], i, s2;
    for (i = 1; i <= 3; i++) {
      s2 = (d.from + i) % 4;
      if (g.passed.indexOf(s2) >= 0) continue;
      claimsFor(g, s2, d.tile, d.from).forEach(function (c) { order.push({ seat: s2, claim: c }); });
    }
    var rank = { win: 0, kong: 1, pung: 1, chow: 2 };
    order.sort(function (a, b) { return rank[a.claim.kind] - rank[b.claim.kind]; });
    var mine = order.filter(function (o) { return o.seat === HUMAN && (o.claim.kind === 'win' || claimHelps(g, HUMAN, o.claim)); });
    var best = order.filter(function (o) { return o.seat !== HUMAN && claimHelps(g, o.seat, o.claim); })[0];
    if (mine.length && (!best || rank[mine[0].claim.kind] <= rank[best.claim.kind])) {
      g.offer = { seat: HUMAN, claims: mine.map(function (o) { return o.claim; }), from: d.from };
      return { wait: 'offer' };
    }
    if (best) {
      if (best.claim.kind === 'win') { finish(g, best.seat, best.claim.score, 'discard', d); return { event: 'win' }; }
      applyClaim(g, best.seat, best.claim, d.from);
      return { event: 'claim', seat: best.seat };
    }
    g.lastDiscard = null; g.passed = [];
    drawTile(g, nextSeat(d.from));
    return { event: 'draw', seat: g.turn };
  }
  return null;
}

function discard(g, seat, tile) {
  var s = g.seats[seat];
  if (!s.counts[tile]) return false;
  s.counts[tile]--;
  s.discards.push(tile);
  say(g, WIND[seatWind(g, seat)] + ' 打 ' + E.tileName(tile), seat);
  g.lastDiscard = { tile: tile, from: seat };
  g.drawn = null; g.passed = []; g.phase = 'claim'; g.selfKongs = null;
  return true;
}

/* ---------- what the page calls ---------- */
function humanDiscard(g, tile) {
  if (g.phase !== 'discard' || g.turn !== HUMAN) return false;
  return discard(g, HUMAN, tile);
}
function humanConcealedKong(g, tile) {
  if (g.phase !== 'discard' || g.turn !== HUMAN || g.seats[HUMAN].counts[tile] < 4) return false;
  g.seats[HUMAN].counts[tile] -= 4;
  g.seats[HUMAN].melds.push({ type: 'kong', tile: tile, concealed: true });
  say(g, '你 暗槓 ' + E.tileName(tile), HUMAN);
  drawTile(g, HUMAN, true);
  return true;
}
function humanTake(g, claim) {
  var o = g.offer;
  if (!o) return false;
  g.offer = null;
  if (claim.kind === 'win') {
    finish(g, HUMAN, claim.score, o.selfDraw ? 'selfDraw' : 'discard',
      o.selfDraw ? null : { tile: claim.tile, from: o.from });
    return true;
  }
  applyClaim(g, HUMAN, claim, o.from);
  return true;
}
function humanPass(g) {
  if (!g.offer) return false;
  var o = g.offer;
  g.offer = null;
  if (o.selfDraw) { g.phase = 'discard'; return true; }
  g.passed.push(HUMAN);
  return true;
}

var HKG_WIND = WIND;
root.HKG = {
  HUMAN: HUMAN, WIND: WIND, threat: threat, danger: danger, risk: risk, flushSuit: flushSuit, seen: seen, newGame: newGame, step: step, seatWind: seatWind,
  handSize: handSize, shantenOf: shantenOf, ctxFor: ctxFor, claimsFor: claimsFor,
  humanDiscard: humanDiscard, humanConcealedKong: humanConcealedKong,
  humanTake: humanTake, humanPass: humanPass, botDiscard: botDiscard, winWith: winWith
};
})(typeof module !== 'undefined' && module.exports ? module.exports : (typeof window !== 'undefined' ? window : globalThis),
   (typeof module !== 'undefined' && module.exports ? require('./engine.js').HKM : (typeof window !== 'undefined' ? window.HKM : globalThis.HKM)));

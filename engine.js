/* Hong Kong Mahjong engine: hand parsing, shanten, ukeire, faan scoring.
   Tile index 0-33: 0-8 筒1-9, 9-17 索1-9, 18-26 萬1-9, 27-30 東南西北, 31-33 中發白 */
(function (root) {
'use strict';

var SUIT_CH = ['筒', '索', '萬'];
var HONOR_CH = ['東', '南', '西', '北', '中', '發', '白'];
var WINDS = [27, 28, 29, 30];
var DRAGONS = [31, 32, 33];
var ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

function isHonor(i) { return i >= 27; }
function suitOf(i) { return i < 27 ? Math.floor(i / 9) : 3; }
function rankOf(i) { return i < 27 ? (i % 9) + 1 : i - 26; }
function isTerminal(i) { return !isHonor(i) && (rankOf(i) === 1 || rankOf(i) === 9); }
function isEdge(i) { return isHonor(i) || isTerminal(i); }

function tileName(i) {
  return isHonor(i) ? HONOR_CH[i - 27] : rankOf(i) + SUIT_CH[suitOf(i)];
}

/* Shorthand: "123p 456s 99m 東東中中" or "123筒 456索". Letters p/s/m or 筒/索/萬. */
var LETTER = { p: 0, d: 0, s: 1, b: 1, m: 2, c: 2, '筒': 0, '索': 1, '萬': 2 };
function parseHand(text) {
  var counts = new Array(34).fill(0), pending = [], bad = [], i, ch, s, n;
  for (i = 0; i < text.length; i++) {
    ch = text[i];
    if (ch >= '0' && ch <= '9') { pending.push(+ch); continue; }
    s = LETTER[ch.toLowerCase()] !== undefined ? LETTER[ch.toLowerCase()] : LETTER[ch];
    if (s !== undefined && pending.length) {
      while (pending.length) { n = pending.shift(); if (n >= 1 && n <= 9) counts[s * 9 + n - 1]++; else bad.push(n + ch); }
      continue;
    }
    n = HONOR_CH.indexOf(ch);
    if (n >= 0) { counts[27 + n]++; continue; }
    if (/\s|,/.test(ch)) { pending = []; continue; }
    if (ch !== 'z' && ch !== 'w') bad.push(ch);
  }
  return { counts: counts, unparsed: bad };
}

var KONG_RE = /(暗|明)\s*槓\s*([1-9]\s*[psmdbcPSMDBC筒索萬]|[東南西北中發白])/g;
/* "暗槓中 明槓3筒 123456789筒 東東" -> rack counts plus the declared kongs */
function parseFull(text) {
  var kongs = [];
  var rest = String(text).replace(KONG_RE, function (_, kind, tile) {
    var c = parseHand(tile).counts, idx = c.indexOf(1);
    if (idx >= 0) kongs.push({ tile: idx, concealed: kind === '暗' });
    return ' ';
  });
  var r = parseHand(rest);
  return { counts: r.counts, kongs: kongs, unparsed: r.unparsed };
}

function formatHand(counts, kongs) {
  var out = [], s, r, k, parts;
  (kongs || []).forEach(function (kk) {
    out.push((kk.concealed ? '暗槓' : '明槓') + tileName(kk.tile));
  });
  for (s = 0; s < 3; s++) {
    parts = '';
    for (r = 1; r <= 9; r++) for (k = 0; k < counts[s * 9 + r - 1]; k++) parts += r;
    if (parts) out.push(parts + SUIT_CH[s]);
  }
  var hon = '';
  for (var i = 27; i < 34; i++) for (var j = 0; j < counts[i]; j++) hon += HONOR_CH[i - 27];
  if (hon) out.push(hon);
  return out.join(' ');
}

function countsToTiles(counts) {
  var t = [], i, k;
  for (i = 0; i < 34; i++) for (k = 0; k < counts[i]; k++) t.push(i);
  return t;
}
function total(counts) { return counts.reduce(function (a, b) { return a + b; }, 0); }

/* ---------- shanten ---------- */
/* -1 = complete hand, 0 = tenpai (one tile away), n = n tiles from tenpai. */
function standardShanten(c, declared) {
  var cnt = c.slice(), best = 8;
  declared = declared || 0;
  function walk(i, melds, parts, pair) {
    if (melds + parts > 5) return;
    if (i >= 34) {
      var p = parts, sh;
      if (melds + p > 5) p = 5 - melds;
      sh = 8 - 2 * melds - p;
      if (melds + p === 5 && !pair) sh += 1;
      if (sh < best) best = sh;
      return;
    }
    if (cnt[i] === 0) { walk(i + 1, melds, parts, pair); return; }
    if (cnt[i] >= 3) { cnt[i] -= 3; walk(i, melds + 1, parts, pair); cnt[i] += 3; }
    if (!isHonor(i) && rankOf(i) <= 7 && cnt[i + 1] && cnt[i + 2]) {
      cnt[i]--; cnt[i + 1]--; cnt[i + 2]--; walk(i, melds + 1, parts, pair);
      cnt[i]++; cnt[i + 1]++; cnt[i + 2]++;
    }
    if (cnt[i] >= 2) { cnt[i] -= 2; walk(i, melds, parts + 1, true); cnt[i] += 2; }
    if (!isHonor(i) && rankOf(i) <= 8 && cnt[i + 1]) {
      cnt[i]--; cnt[i + 1]--; walk(i, melds, parts + 1, pair); cnt[i]++; cnt[i + 1]++;
    }
    if (!isHonor(i) && rankOf(i) <= 7 && cnt[i + 2]) {
      cnt[i]--; cnt[i + 2]--; walk(i, melds, parts + 1, pair); cnt[i]++; cnt[i + 2]++;
    }
    var keep = cnt[i]; cnt[i] = 0; walk(i + 1, melds, parts, pair); cnt[i] = keep;
  }
  walk(0, declared, 0, false);
  return best;
}

function orphanShanten(c) {
  var kinds = 0, pair = 0;
  ORPHANS.forEach(function (i) { if (c[i] > 0) kinds++; if (c[i] >= 2) pair = 1; });
  return 13 - kinds - pair;
}

function shanten(c, concealed, declared) {
  var s = standardShanten(c, declared);
  /* thirteen orphans is exactly 13 tiles and a pair: a kong rules it out */
  if (concealed !== false && !declared) s = Math.min(s, orphanShanten(c));
  return s;
}

/* ---------- winning decompositions: 4 sets + 1 pair ---------- */
function decompose(c, declared) {
  var cnt = c.slice(), out = [], seen = {}, need = 4 - (declared || 0);
  function walk(i, sets, pair) {
    if (sets.length === need && pair !== null) {
      var key = sets.map(function (s) { return s.type + s.tile; }).sort().join(',') + '|' + pair;
      if (total(cnt) === 0 && !seen[key]) { seen[key] = 1; out.push({ sets: sets.slice(), pair: pair }); }
      return;
    }
    while (i < 34 && cnt[i] === 0) i++;
    if (i >= 34) return;
    if (cnt[i] >= 3 && sets.length < need) {
      cnt[i] -= 3; sets.push({ type: 'pung', tile: i }); walk(i, sets, pair); sets.pop(); cnt[i] += 3;
    }
    if (!isHonor(i) && rankOf(i) <= 7 && cnt[i + 1] && cnt[i + 2] && sets.length < need) {
      cnt[i]--; cnt[i + 1]--; cnt[i + 2]--; sets.push({ type: 'chow', tile: i });
      walk(i, sets, pair); sets.pop(); cnt[i]++; cnt[i + 1]++; cnt[i + 2]++;
    }
    if (cnt[i] >= 2 && pair === null) {
      cnt[i] -= 2; walk(i, sets, i); cnt[i] += 2;
    }
  }
  walk(0, [], null);
  return out;
}

/* ---------- faan ---------- */
var FAAN = {
  chicken: ['雞和', 'Chicken hand', 0],
  selfDraw: ['自摸', 'Self-draw', 1],
  concealed: ['門前清', 'Fully concealed', 1],
  allChows: ['平和', 'All chows, no honours', 1],
  seatWind: ['門風', 'Seat wind pung', 1],
  roundWind: ['圈風', 'Round wind pung', 1],
  dragon: ['番牌', 'Dragon pung', 1],
  flower: ['花牌', 'Own flower', 1],
  lastTile: ['海底撈月', 'Last tile of the wall', 1],
  kongDraw: ['槓上開花', 'Win on kong replacement', 1],
  robKong: ['搶槓', 'Robbing the kong', 1],
  allPungs: ['對對和', 'All pungs', 3],
  halfFlush: ['混一色', 'Half flush', 3],
  smallDragons: ['小三元', 'Small three dragons', 5],
  smallWinds: ['小四喜', 'Small four winds', 6],
  fullFlush: ['清一色', 'Full flush', 7],
  greatDragons: ['大三元', 'Great three dragons', 8],
  concealedPungs: ['坎坎和', 'Concealed all pungs', 8],
  allHonors: ['字一色', 'All honours', 10],
  allEdges: ['全幺九', 'All terminals and honours', 10],
  nineGates: ['九蓮寶燈', 'Nine gates', 10],
  pureTerminals: ['清么九', 'All terminals', 13],
  greatWinds: ['大四喜', 'Great four winds', 13],
  orphans: ['十三么', 'Thirteen orphans', 13],
  fourKongs: ['十八羅漢', 'Four kongs', 13]
};
var LIMIT = 13;
/* each key hides the keys it already pays for, so nothing is counted twice */
var ABSORBS = {
  fullFlush: ['halfFlush'],
  allHonors: ['allPungs', 'halfFlush', 'dragon', 'seatWind', 'roundWind', 'allEdges', 'smallDragons', 'smallWinds'],
  allEdges: ['allPungs'],
  pureTerminals: ['allPungs', 'allEdges', 'fullFlush', 'halfFlush'],
  greatDragons: ['dragon', 'smallDragons'],
  smallDragons: ['dragon'],
  greatWinds: ['seatWind', 'roundWind', 'smallWinds'],
  smallWinds: ['seatWind', 'roundWind'],
  concealedPungs: ['allPungs', 'concealed'],
  nineGates: ['fullFlush', 'halfFlush', 'concealed'],
  orphans: ['concealed', 'allEdges', 'halfFlush'],
  fourKongs: ['allPungs']
};

function meldTiles(m) {
  if (m.type === 'chow') return [m.tile, m.tile + 1, m.tile + 2];
  return m.type === 'kong' ? [m.tile, m.tile, m.tile, m.tile] : [m.tile, m.tile, m.tile];
}
/* ctx.kongs is the older spelling of a kong-only meld list */
function allMelds(ctx) {
  return (ctx.melds || []).concat((ctx.kongs || []).map(function (k) {
    return { type: 'kong', tile: k.tile, concealed: k.concealed };
  }));
}

function isNineGates(c) {
  for (var s = 0; s < 3; s++) {
    var ok = true, extra = 0, r;
    for (var i = 0; i < 34; i++) if (c[i] && suitOf(i) !== s) { ok = false; break; }
    if (!ok) continue;
    for (r = 1; r <= 9; r++) {
      var need = (r === 1 || r === 9) ? 3 : 1, have = c[s * 9 + r - 1];
      if (have < need) { ok = false; break; }
      extra += have - need;
    }
    if (ok && extra === 1) return true;
  }
  return false;
}

/* ctx: {seat, round, selfDraw, concealed, flowers, lastTile, kongDraw, robKong} */
function scoreDecomposition(d, c, ctx) {
  var hits = [], add = function (k, n) { hits.push({ key: k, faan: n === undefined ? FAAN[k][2] : n }); };
  var melds = allMelds(ctx);
  var cAll = c.slice();
  melds.forEach(function (m) { meldTiles(m).forEach(function (t) { cAll[t] += 1; }); });
  var tiles = countsToTiles(cAll);
  var suits = {}, honors = 0;
  tiles.forEach(function (t) { if (isHonor(t)) honors++; else suits[suitOf(t)] = 1; });
  var suitCount = Object.keys(suits).length;
  var allSets = d.sets.concat(melds.map(function (m) {
    return { type: m.type === 'chow' ? 'chow' : 'pung', tile: m.tile,
      kong: m.type === 'kong', concealed: m.concealed };
  }));
  var pungs = allSets.filter(function (s) { return s.type === 'pung'; });
  var chows = allSets.filter(function (s) { return s.type === 'chow'; });

  if (ctx.selfDraw) add('selfDraw');
  if (ctx.concealed) add('concealed');
  if (ctx.lastTile) add('lastTile');
  if (ctx.kongDraw) add('kongDraw');
  if (ctx.robKong) add('robKong');
  if (ctx.flowers) add('flower', ctx.flowers * FAAN.flower[2]);

  if (chows.length === 4 && honors === 0) add('allChows');
  if (pungs.length === 4) add('allPungs');
  if (pungs.length === 4 && ctx.concealed) add('concealedPungs');

  var dragonPungs = pungs.filter(function (s) { return DRAGONS.indexOf(s.tile) >= 0; }).length;
  for (var i = 0; i < dragonPungs; i++) add('dragon');
  if (dragonPungs === 3) add('greatDragons');
  else if (dragonPungs === 2 && DRAGONS.indexOf(d.pair) >= 0) add('smallDragons');

  var windPungs = pungs.filter(function (s) { return WINDS.indexOf(s.tile) >= 0; });
  if (windPungs.some(function (s) { return s.tile === 27 + ctx.seat; })) add('seatWind');
  if (windPungs.some(function (s) { return s.tile === 27 + ctx.round; })) add('roundWind');
  if (windPungs.length === 4) add('greatWinds');
  else if (windPungs.length === 3 && WINDS.indexOf(d.pair) >= 0) add('smallWinds');

  if (suitCount === 1 && honors === 0) add('fullFlush');
  else if (suitCount === 1 && honors > 0) add('halfFlush');
  if (suitCount === 0) add('allHonors');

  var everyEdge = tiles.every(isEdge);
  if (everyEdge && pungs.length === 4 && suitCount > 0) add(tiles.every(function (t) { return !isHonor(t); }) ? 'pureTerminals' : 'allEdges');
  if (ctx.concealed && !melds.length && isNineGates(cAll)) add('nineGates');
  if (melds.filter(function (m) { return m.type === 'kong'; }).length === 4) add('fourKongs');

  var hidden = {};
  hits.forEach(function (h) { (ABSORBS[h.key] || []).forEach(function (k) { hidden[k] = 1; }); });
  var kept = hits.filter(function (h) { return !hidden[h.key]; });
  var faan = kept.reduce(function (a, h) { return a + h.faan; }, 0);
  if (!kept.length) kept.push({ key: 'chicken', faan: 0 });
  return { faan: Math.min(faan, LIMIT), raw: faan, patterns: kept, sets: allSets, pair: d.pair };
}

/* HK old-style payment units by faan (house rules vary; 13 faan is the limit) */
var UNITS = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384];
function units(faan) { return UNITS[Math.min(faan, LIMIT)]; }

function score(c, ctx) {
  ctx = Object.assign({ seat: 0, round: 0, selfDraw: false, concealed: true, flowers: 0, kongs: [] }, ctx || {});
  var ms = allMelds(ctx), nk = ms.length;
  if (ms.some(function (m) { return !m.concealed; })) ctx.concealed = false;
  /* every declared meld takes one set, and three tiles, out of the rack */
  if (total(c) !== 14 - 3 * nk) return null;
  var best = null;
  decompose(c, nk).forEach(function (d) {
    var s = scoreDecomposition(d, c, ctx);
    if (!best || s.faan > best.faan) best = s;
  });
  if (ctx.concealed && !nk && orphanShanten(c) === -1) {
    var hits = [{ key: 'orphans', faan: FAAN.orphans[2] }];
    if (ctx.selfDraw) hits.push({ key: 'selfDraw', faan: 1 });
    if (ctx.flowers) hits.push({ key: 'flower', faan: ctx.flowers });
    var f = Math.min(hits.reduce(function (a, h) { return a + h.faan; }, 0), LIMIT);
    if (!best || f > best.faan) best = { faan: f, raw: f, patterns: hits, sets: [], pair: null, orphans: true };
  }
  if (best) best.units = units(best.faan);
  return best;
}

/* ---------- waits and discards ---------- */
function liveCopies(c, i, seen) { return Math.max(0, 4 - c[i] - ((seen && seen[i]) || 0)); }

/* Tiles that bring a 13-tile hand closer to (or into) a win. */
function ukeire(c, ctx, seen) {
  var ms = allMelds(ctx), nk = ms.length, gone = {}, i;
  ms.forEach(function (m) {
    meldTiles(m).forEach(function (t) { gone[t] = (gone[t] || 0) + 1; });
  });
  if (seen) for (i in seen) gone[i] = (gone[i] || 0) + seen[i];
  var base = shanten(c, ctx.concealed, nk), out = [];
  for (i = 0; i < 34; i++) {
    if (c[i] + (gone[i] || 0) >= 4) continue;
    c[i]++;
    var after = shanten(c, ctx.concealed, nk);
    if (after < base) {
      var entry = { tile: i, live: liveCopies(c, i, gone) + 1, winning: after === -1 };
      if (after === -1) { var s = score(c, ctx); entry.faan = s ? s.faan : 0; entry.patterns = s ? s.patterns : []; }
      out.push(entry);
    }
    c[i]--;
  }
  return { shanten: base, tiles: out, live: out.reduce(function (a, t) { return a + t.live; }, 0) };
}

/* For a 14-tile hand: rank every discard by what it leaves behind. */
function discards(c, ctx, seen) {
  var out = [], i;
  for (i = 0; i < 34; i++) {
    if (!c[i]) continue;
    c[i]--;
    var u = ukeire(c, ctx, seen);
    out.push({ tile: i, shanten: u.shanten, live: u.live, waits: u.tiles });
    c[i]++;
  }
  out.sort(function (a, b) { return a.shanten - b.shanten || b.live - a.live || a.tile - b.tile; });
  return out;
}

root.HKM = {
  SUIT_CH: SUIT_CH, HONOR_CH: HONOR_CH, FAAN: FAAN, LIMIT: LIMIT, ORPHANS: ORPHANS,
  parseFull: parseFull, formatHand: formatHand, meldTiles: meldTiles, allMelds: allMelds,
  isHonor: isHonor, suitOf: suitOf, rankOf: rankOf, isTerminal: isTerminal, isEdge: isEdge,
  tileName: tileName, parseHand: parseHand, countsToTiles: countsToTiles, total: total,
  shanten: shanten, standardShanten: standardShanten, orphanShanten: orphanShanten,
  decompose: decompose, score: score, units: units, ukeire: ukeire, discards: discards
};
})(typeof module !== 'undefined' && module.exports ? module.exports : (typeof window !== 'undefined' ? window : globalThis));

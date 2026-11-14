/* node test.js — asserts the faan/shanten logic. No framework on purpose. */
const assert = require('assert');
const { HKM } = require('./engine.js');
const { HKG } = require('./game.js');
const { parseHand, shanten, score, discards, ukeire, tileName, total } = HKM;

const h = (s) => { const r = parseHand(s); assert.deepStrictEqual(r.unparsed, [], 'unparsed in ' + s); return r.counts; };
const names = (s) => s.patterns.map(p => HKM.FAAN[p.key][0]).sort().join('+');

// --- parsing ---
assert.strictEqual(total(h('123456789筒 123索 東東')), 14);
assert.strictEqual(total(h('123p456s789m 中中中 東東')), 14);
assert.strictEqual(tileName(0), '1筒');
assert.strictEqual(tileName(33), '白');

// --- shanten ---
assert.strictEqual(shanten(h('123456789p 11s 23s')), 0, 'tenpai: 3 melds + pair + partial');
assert.strictEqual(shanten(h('123456789p 123s 1m')), 0, 'tenpai: 4 melds, waiting on the pair');
assert.strictEqual(shanten(h('123456789p 12s 45s')), 1, 'five blocks but no pair yet');
assert.strictEqual(HKM.standardShanten(h('147p 147s 147m 東南西北')), 8, 'worst standard hand');
assert.strictEqual(shanten(h('147p 147s 147m 東南西北')), 6, 'but only 6 from thirteen orphans');
assert.strictEqual(shanten(h('112233445566p 7p')), 0, '4 chows, waiting on the pair');
assert.strictEqual(shanten(h('123456789p 123s 11m')), -1, 'complete hand');
assert.strictEqual(HKM.orphanShanten(h('19p19s19m 東南西北中發白')), 0, 'thirteen orphans tenpai');
assert.strictEqual(HKM.orphanShanten(h('119p19s19m 東南西北中發白')), -1, 'thirteen orphans complete');
assert.strictEqual(shanten(h('19p19s19m 東南西北中發白')), 0, 'orphans counted for concealed hands');
assert.strictEqual(shanten(h('19p19s19m 東南西北中發白'), false), 8, 'orphans ignored once melded');

// --- faan: basics ---
let s = score(h('123456789p 123s 11m'), { concealed: true, selfDraw: false });
assert.strictEqual(s.faan, 2, '平和 + 門前清'); assert.strictEqual(names(s), '平和+門前清');

s = score(h('123456789p 123s 11m'), { concealed: false });
assert.strictEqual(s.faan, 1, 'melded: 平和 only');

s = score(h('123456789p 123s 11m'), { concealed: true, selfDraw: true, flowers: 2 });
assert.strictEqual(s.faan, 5, '平和1 + 門前清1 + 自摸1 + 2 flowers');

// --- faan: flushes ---
s = score(h('123456789p 123p 11p'), { concealed: false });
assert.strictEqual(s.faan, 8, '清一色 7 + 平和 1 stack');
assert.ok(names(s).includes('清一色'));
assert.ok(!names(s).includes('混一色'), '清一色 absorbs 混一色');

s = score(h('123456789p 123p 東東'), { concealed: false });
assert.strictEqual(s.faan, 3, '混一色');

// --- faan: pungs and honours ---
s = score(h('111p 999p 111s 999s 東東'), { concealed: false, seat: 0, round: 0 });
assert.ok(names(s).includes('全幺九'), 'terminals + honour pair');
assert.strictEqual(s.faan, 10);
assert.ok(!names(s).includes('對對和'), '全幺九 absorbs 對對和');

s = score(h('111p 999p 111s 999s 11m'), { concealed: false });
assert.strictEqual(s.faan, 13, '清么九 is a limit hand');

s = score(h('中中中 發發發 白白白 111p 22p'), { concealed: false });
assert.strictEqual(s.faan, 13, '大三元 8 + 對對和 3 + 混一色 3 = 14, capped at the limit');
assert.strictEqual(s.raw, 14, 'raw total before the cap');
assert.ok(!names(s).includes('番牌'), '大三元 absorbs the dragon pungs');

s = score(h('中中中 發發發 白白 111p 222p'), { concealed: false });
assert.strictEqual(s.faan, 5 + 3 + 3, '小三元 + 對對和 + 混一色');

s = score(h('東東東 南南南 西西西 北北北 11p'), { concealed: false, seat: 0, round: 0 });
assert.strictEqual(s.faan, 13, '大四喜');

s = score(h('東東東 111p 222p 333p 55p'), { concealed: false, seat: 0, round: 1 });
assert.strictEqual(s.faan, 3 + 3 + 1, '混一色 + 對對和 + seat wind');
s = score(h('東東東 111p 222p 333p 55p'), { concealed: false, seat: 1, round: 0 });
assert.strictEqual(s.faan, 3 + 3 + 1, 'same hand, now the round wind');
s = score(h('東東東 111p 222p 333p 55p'), { concealed: false, seat: 0, round: 0 });
assert.strictEqual(s.faan, 3 + 3 + 2, 'seat and round wind both pay');

s = score(h('東東東 南南南 西西西 中中中 白白'), { concealed: false, seat: 2, round: 3 });
assert.strictEqual(s.faan, 10, '字一色');

s = score(h('111p 222p 333p 444p 55p'), { concealed: true, selfDraw: true });
assert.ok(names(s).includes('坎坎和'));
assert.strictEqual(s.faan, 13, '清一色 7 + 坎坎和 8 + 自摸 1, capped');
assert.strictEqual(s.raw, 16);

s = score(h('1112345678999p 5p'), { concealed: true });
assert.ok(names(s).includes('九蓮寶燈'), '九蓮寶燈');
assert.strictEqual(s.faan, 10);

s = score(h('119p19s19m 東南西北中發白'), { concealed: true });
assert.strictEqual(s.faan, 13, '十三么');

// chicken hand: a win with nothing to name
s = score(h('123p 456s 789m 東東東 11p'), { concealed: false, seat: 1, round: 2 });
assert.strictEqual(s.faan, 0, 'chicken hand'); assert.strictEqual(names(s), '雞和');

// limit cap and payout table
assert.strictEqual(score(h('東東東 南南南 西西西 北北北 11p'), { concealed: true, selfDraw: true, flowers: 2 }).faan, 13, 'capped at the limit');
assert.strictEqual(HKM.units(0), 1); assert.strictEqual(HKM.units(3), 8); assert.strictEqual(HKM.units(13), 384);
assert.strictEqual(HKM.units(99), 384, 'above the limit still pays the limit');

// --- waits ---
let u = ukeire(h('123456789p 123s 1m'), { concealed: true });
assert.strictEqual(u.shanten, 0);
assert.deepStrictEqual(u.tiles.map(t => tileName(t.tile)), ['1萬'], 'pair wait');
assert.strictEqual(u.tiles[0].live, 3, 'three 1萬 left');
assert.ok(u.tiles[0].winning && u.tiles[0].faan === 2, 'the wait wins for 平和 + 門前清');

u = ukeire(h('123456789p 11s 23s'), { concealed: true });
assert.deepStrictEqual(u.tiles.map(t => tileName(t.tile)).sort(), ['1索', '4索'], 'two-sided wait');

// --- discards ---
let d = discards(h('123456789p 123s 1m 9m'), { concealed: true });
assert.strictEqual(d[0].shanten, 0, 'best discard reaches tenpai');
assert.ok(['1萬', '9萬'].includes(tileName(d[0].tile)), 'drop a floater, not a meld');
d = discards(h('1234p 5678s 234m 東北'), { concealed: true });
assert.ok(['東', '北'].includes(tileName(d[0].tile)), 'lone winds go first: ' + tileName(d[0].tile));

// a winning 14-tile hand: no discard beats standing pat
assert.ok(score(h('123456789p 123s 11m'), { concealed: true }), 'win detected on 14 tiles');

// --- kongs ---
const K = (...ks) => ks.map(([tile, concealed]) => ({ tile: parseHand(tile).counts.indexOf(1), concealed }));

// parsing and round-trip
let pf = HKM.parseFull('暗槓中 明槓3筒 123456789筒 東東');
assert.strictEqual(total(pf.counts), 11, 'rack is 14 - 3 per kong');
assert.deepStrictEqual(pf.kongs, [{ tile: 31, concealed: true }, { tile: 2, concealed: false }]);
assert.strictEqual(HKM.formatHand(pf.counts, pf.kongs), '暗槓中 明槓3筒 123456789筒 東東', 'notation round-trips');

// a kong fills a set, so the rack needs one fewer
assert.strictEqual(shanten(h('123456789筒 東'), true, 1), 0, 'kong + 3 chows, waiting on the pair');
assert.strictEqual(shanten(h('123456789筒 東東'), true, 1), -1, 'kong + 3 chows + pair is complete');
assert.strictEqual(shanten(h('19p19s19m 東南西北中發白'), true, 0), 0, 'orphans tenpai while nothing is declared');
assert.strictEqual(shanten(h('19p19s19m 東南西北中發白'), true, 1), 6,
  'a declared kong rules thirteen orphans out, so only the standard count applies');

// scoring: the kong counts as its pung
s = score(h('123456789筒 東東'), { concealed: true, kongs: K(['中', true]) });
assert.strictEqual(s.faan, 5, '混一色 3 + 番牌 1 + 門前清 1');
assert.ok(names(s).includes('番牌'), 'the concealed kong pays as a dragon pung');
assert.strictEqual(score(h('123456789筒 東東'), { concealed: false, kongs: K(['中', false]) }).faan, 4,
  'an exposed kong costs you 門前清');

// wrong hand size for the number of kongs is not a win
assert.strictEqual(score(h('123456789筒 123索 11萬'), { kongs: K(['中', true]) }), null, '14 rack tiles with a kong is too many');
assert.strictEqual(score(h('123456789筒 東東'), {}), null, '11 rack tiles with no kong is too few');

// 坎坎和 survives concealed kongs
s = score(h('111筒 222筒 333筒 55筒'), { concealed: true, kongs: K(['4筒', true]) });
assert.ok(names(s).includes('坎坎和'), 'three concealed pungs plus a concealed kong');
assert.strictEqual(s.faan, 13, '清一色 7 + 坎坎和 8 capped');

// 十八羅漢
s = score(h('55筒'), { concealed: true, kongs: K(['1筒', true], ['2筒', true], ['3筒', true], ['4筒', false]) });
assert.ok(names(s).includes('十八羅漢'), 'four kongs');
assert.strictEqual(s.faan, 13);

// tiles locked in a kong are not offered as draws
u = ukeire(h('123456789筒 東'), { concealed: true, kongs: K(['中', true]) });
assert.strictEqual(u.shanten, 0);
assert.ok(!u.tiles.some(t => tileName(t.tile) === '中'), 'all four 中 are already in your kong');
u = ukeire(h('123456789筒 123索 1萬'), { concealed: true }, { 18: 2 });
assert.strictEqual(u.tiles[0].live, 1, 'tiles already seen on the table come off the live count');

// discards respect the smaller rack
d = discards(h('123456789筒 東南'), { concealed: true, kongs: K(['中', true]) });
assert.strictEqual(d[0].shanten, 0, 'drop a lone wind and you are tenpai');
assert.ok(['東', '南'].includes(tileName(d[0].tile)));

// --- the game loop ---
function autoplay(seed, maxBeats = 4000) {
  const g = HKG.newGame({ seed });
  let beats = 0;
  while (g.phase !== 'over' && beats++ < maxBeats) {
    // every seat holds its full hand on its turn, one fewer otherwise
    g.seats.forEach((s, i) => {
      const held = total(s.counts), want = HKG.handSize(s);
      const expect = (g.phase === 'discard' && g.turn === i) ? want : want - 1;
      assert.strictEqual(held, expect,
        `seat ${i} holds ${held}, expected ${expect} (phase ${g.phase}, turn ${g.turn}, seed ${seed})`);
      assert.ok(s.counts.every(n => n >= 0 && n <= 4), 'tile counts stay within 0..4');
    });
    const r = HKG.step(g);
    if (r && r.wait === 'discard') { assert.ok(HKG.humanDiscard(g, HKG.botDiscard(g, 0)), 'human discard applies'); continue; }
    if (r && r.wait === 'offer') {
      const c = g.offer.claims;
      const win = c.find(x => x.kind === 'win');
      if (win) HKG.humanTake(g, win);
      else HKG.humanPass(g);
      continue;
    }
    if (!r) break;
  }
  assert.ok(g.phase === 'over', `game ${seed} ended (beats ${beats})`);
  return { g, beats };
}

let wins = 0, draws = 0;
for (let seed = 1; seed <= 40; seed++) {
  const { g } = autoplay(seed);
  assert.ok(g.result, 'a finished game has a result');
  if (g.result.seat === null) { draws++; assert.strictEqual(g.wall.length, 0, 'a draw empties the wall'); }
  else {
    wins++;
    const sc = g.result.score;
    assert.ok(sc.faan >= 0 && sc.faan <= HKM.LIMIT, 'faan within range');
    assert.ok(sc.patterns.length > 0, 'a win names at least one pattern');
    assert.strictEqual(total(g.seats[g.result.seat].counts), HKG.handSize(g.seats[g.result.seat]),
      'the winner holds a complete hand');
  }
}
assert.ok(wins > 0, `${wins} of 40 games were won`);
assert.strictEqual(wins + draws, 40);

// chow is only legal from the seat on your left
(() => {
  const g = HKG.newGame({ seed: 7 });
  g.seats[1].counts = h('234筒');
  // seat 0 discards: seat 1 sits to its left, so seat 1 may chow and seat 2 may not
  const fromLeft = HKG.claimsFor(g, 1, HKM.parseHand('5筒').counts.indexOf(1), 0);
  const fromElsewhere = HKG.claimsFor(g, 2, HKM.parseHand('5筒').counts.indexOf(1), 0);
  assert.ok(fromLeft.some(c => c.kind === 'chow'), 'the seat to the left may chow');
  assert.ok(!fromElsewhere.some(c => c.kind === 'chow'), 'other seats may not');
})();

// a minimum-faan table refuses a chicken hand
(() => {
  // dealer 2 puts seat 0 on 西, so the 東 pung pays neither wind: 門前清 alone, 1 faan
  const g = HKG.newGame({ seed: 3, minFaan: 3, dealer: 2 });
  g.seats[0].counts = h('123筒 456索 789萬 東東東 1萬');
  const nine = HKM.parseHand('1萬').counts.indexOf(1);
  assert.ok(!HKG.winWith(g, 0, nine), 'a 1-faan hand cannot win at a 3-faan table');
  g.minFaan = 0;
  assert.ok(HKG.winWith(g, 0, nine), 'but it wins where there is no minimum');
})();

// --- defence ---
const T = s => HKM.parseHand(s).counts.indexOf(1);

// nobody is a threat at the deal
(() => {
  const g = HKG.newGame({ seed: 5 });
  [1, 2, 3].forEach(s => assert.strictEqual(HKG.threat(g, s), 0, 'no threat before anyone acts'));
  assert.strictEqual(HKG.risk(g, 0, T('5筒')).score, 0, 'nothing is risky yet');
})();

// laying sets down, and a dragon pung especially, makes a seat dangerous
(() => {
  const g = HKG.newGame({ seed: 5 });
  const plain = (() => { g.seats[2].melds = [{ type: 'chow', tile: 0, concealed: false }]; return HKG.threat(g, 2); })();
  g.seats[2].melds = [{ type: 'pung', tile: 31, concealed: false },
                      { type: 'pung', tile: 32, concealed: false }];
  assert.ok(HKG.threat(g, 2) > plain, 'two dragon pungs beat one chow for threat');
  assert.ok(HKG.threat(g, 2) > 0.5, `two dragon pungs read as dangerous (${HKG.threat(g, 2).toFixed(2)})`);
})();

// a seat that has stopped throwing one suit is reading as a flush chase
(() => {
  const g = HKG.newGame({ seed: 5 });
  assert.strictEqual(HKG.flushSuit(g, 2), null, 'no read from an empty pond');
  g.seats[2].discards = ['1筒', '9筒', '3筒', '東', '5筒', '白'].map(T);   // throwing 筒, keeping 索/萬
  assert.strictEqual(HKG.flushSuit(g, 2), null, 'throwing one suit is not yet a read');
  g.seats[2].discards = ['1索', '9索', '3萬', '7萬', '東', '白'].map(T);   // throwing 索 and 萬, keeping 筒
  assert.strictEqual(HKG.flushSuit(g, 2), 0, 'keeping only 筒 reads as a 筒 flush');
  g.seats[2].melds = [{ type: 'pung', tile: 31, concealed: false }];
  const hot = HKG.danger(g, 0, T('5筒'), 2), cold = HKG.danger(g, 0, T('5索'), 2);
  assert.ok(hot > cold * 2, `their suit is far hotter than the others (${hot.toFixed(2)} vs ${cold.toFixed(2)})`);
})();

// a tile they threw themselves is rated quieter than the same tile fresh
(() => {
  const g = HKG.newGame({ seed: 5 });
  g.seats[2].melds = [{ type: 'pung', tile: 31, concealed: false }];
  const fresh = HKG.danger(g, 0, T('5萬'), 2);
  g.seats[2].discards = [T('5萬')];
  assert.ok(HKG.danger(g, 0, T('5萬'), 2) < fresh, 'a tile from their own pond reads safer');
})();

// and copies already on the table take the edge off
(() => {
  const g = HKG.newGame({ seed: 5 });
  g.seats[2].melds = [{ type: 'pung', tile: 31, concealed: false }];
  const fresh = HKG.danger(g, 0, T('5萬'), 2);
  g.seats[1].discards = [T('5萬'), T('5萬')];
  assert.ok(HKG.danger(g, 0, T('5萬'), 2) < fresh, 'two copies gone makes it quieter');
})();

// the bot plays speed with nobody to fear, and never raises its risk once there is
(() => {
  const g = HKG.newGame({ seed: 11 });
  const fast = HKG.botDiscard(g, 1);
  const best = HKM.discards(g.seats[1].counts, HKG.ctxFor(g, 1))[0].tile;
  assert.strictEqual(fast, best, 'with no threat on the table the bot throws its fastest tile');

  g.seats[2].melds = [{ type: 'pung', tile: 31, concealed: false },
                      { type: 'pung', tile: 32, concealed: false },
                      { type: 'pung', tile: 27, concealed: false }];
  g.seats[2].discards = ['1索', '9索', '3萬', '7萬', '東', '白'].map(T);
  const safe = HKG.botDiscard(g, 1);
  assert.ok(HKG.risk(g, 1, safe).score <= HKG.risk(g, 1, fast).score,
    'under threat the bot never throws something riskier than its fast choice');
})();

// defence must not deadlock the game
for (let seed = 101; seed <= 115; seed++) {
  const { g } = autoplay(seed);
  assert.ok(g.phase === 'over', 'games still finish with defensive bots');
}

console.log('all checks passed');

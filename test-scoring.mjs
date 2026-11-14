/* The faan table, checked against the worked combinations on
   mahjonggame.hk/learn/hk-mahjong/scoring.  Run: node test-scoring.mjs
   Tiles: 0-8 characters, 9-17 dots, 18-26 bamboo, 27-30 winds E S W N,
   31-33 dragons, 34-37 flowers, 38-41 seasons.
   Unless a case says otherwise the hand has one set open -- a bamboo run -- so that
   the faan for never opening the hand does not quietly sit on top of every figure. */
import assert from 'node:assert';
import { faanFor, nextDeal } from './play/practice.mjs';

const pung = t => [t, t, t];
const chow = t => [t, t + 1, t + 2];
const score = (concealed, opts = {}) => faanFor({
  concealed, exposed: [chow(18)], bonuses: [35], seatWind: 0, won: true, selfDraw: false, ...opts,
});
let n = 0;
const check = (name, got, want) => {
  assert.strictEqual(got.faan, want,
    name + ': got ' + got.faan + ' faan (' + got.had.join(', ') + '), wanted ' + want);
  n++;
};

/* "Great Three Dragons + Half Flush = 11", paid at the ten-faan limit. */
check('great three dragons in one suit',
  score([...pung(31), ...pung(32), ...pung(33), 22, 22]), 10);

/* "Small Three Dragons + Half Flush = 8" */
check('small three dragons in one suit',
  score([...pung(31), ...pung(32), 33, 33, ...chow(21)]), 8);

/* "All Chows + Concealed + Self-Draw = 3" -- two suits, so no flush. */
check('all chows, concealed, self-drawn',
  score([...chow(0), ...chow(3), ...chow(9), ...chow(12), 6, 6],
    { exposed: [], selfDraw: true }), 3);

/* "Full Flush + All Pungs = 10" */
check('full flush and all pungs',
  score([...pung(0), ...pung(3), ...pung(6), 8, 8], { exposed: [pung(5)] }), 10);

/* Four concealed pungs replaces both all pungs and concealed: 8, plus the flush. */
check('four concealed pungs in one suit',
  score([...pung(0), ...pung(3), ...pung(5), ...pung(7), 1, 1], { exposed: [] }), 10);

/* A pung of East held by East counts twice: seat wind and round wind. */
check('east holding a pung of east',
  score([...pung(27), ...chow(0), ...chow(9), 4, 4]), 2);
/* flower-2 is South's own, so South is given West's instead. */
check('south holding a pung of east',
  score([...pung(27), ...chow(0), ...chow(9), 4, 4], { seatWind: 1, bonuses: [36] }), 1);

/* The prevailing wind is the round, so the same pung is worth different things in
   different rounds. seatWind and roundWind are both 0 (East) unless given. */
check('south holding a pung of south in the south round',
  score([...pung(28), ...chow(0), ...chow(9), 4, 4], { seatWind: 1, roundWind: 1, bonuses: [36] }), 2);
check('east holding a pung of east in the south round',
  score([...pung(27), ...chow(0), ...chow(9), 4, 4], { roundWind: 1 }), 1);
/* Neither seat nor round wind now, so the hand falls back to a plain hand's 1. */
check('south holding a pung of east in the south round',
  score([...pung(27), ...chow(0), ...chow(9), 4, 4], { seatWind: 1, roundWind: 1, bonuses: [36] }), 1);

/* Mixed terminals contains all pungs, so all pungs is not counted again. */
/* The honour set is North, which East scores nothing for, so the 4 stands alone. */
check('mixed terminals',
  score([...pung(0), ...pung(8), ...pung(30), 9, 9], { exposed: [pung(26)] }), 4);
check('mixed terminals with a dragon pung on top',
  score([...pung(0), ...pung(8), ...pung(31), 9, 9], { exposed: [pung(26)] }), 5);

/* Thirteen orphans stands alone, paid at the limit. */
check('thirteen orphans',
  score([0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 0], { exposed: [] }), 10);

/* Flowers: a full set is scored instead of the seat flower inside it. */
const chows = [...chow(0), ...chow(3), ...chow(9), 6, 6];
check('a full set of flowers', score(chows, { bonuses: [34, 35, 36, 37] }), 3);
check('your own flower alone', score(chows, { bonuses: [34] }), 2);
check('a flower that is not yours', score(chows, { bonuses: [35] }), 1);
check('no flowers at all', score(chows, { bonuses: [] }), 2);

/* A hand that is not finished scores only what its tiles already show. */
check('an unfinished hand with nothing in it',
  score([0, 2, 4, 9, 11, 13, 18, 20, 22, 27, 28, 29, 31], { exposed: [], won: false }), 0);
check('an unfinished hand holding a dragon pung',
  score([...pung(31), 0, 2, 4, 9, 11, 13, 18, 20, 22], { exposed: [], won: false }), 1);

/* ---- the shape of a match: four rounds, the deal passing each hand ------------- */
const play = wins => {               /* wins: the winner of each hand, in order */
  let s = { dealer: 0, round: 0, dealt: 0 }, hands = 0, over = false;
  for (const winner of wins) {
    const r = nextDeal({ ...s, winner });
    s = { dealer: r.dealer, round: r.round, dealt: r.dealt };
    hands++; over = r.over;
    if (over) break;
  }
  return { ...s, hands, over };
};
/* Nobody holds the deal, so the match is exactly sixteen hands. */
const passing = Array.from({ length: 20 }, (_, i) => (i % 4 + 1) % 4);
let m = play(passing);
assert.strictEqual(m.hands, 16, 'a match where the deal always passes is 16 hands, got ' + m.hands);
assert.ok(m.over, 'that match should be over');
n++;
/* Fifteen hands in, it is the North round and still running. */
m = play(passing.slice(0, 15));
assert.strictEqual(m.round, 3, 'the fifteenth hand should be in the North round, got ' + m.round);
assert.ok(!m.over, 'fifteen hands is not a whole match');
n++;
/* East keeping the deal makes the match longer, and never moves the round on. */
m = play([0, 0, 0]);
assert.deepStrictEqual([m.dealer, m.round, m.dealt], [0, 0, 0], 'East winning three times keeps everything where it was');
n++;
m = play([0, 0, 1]);
assert.deepStrictEqual([m.dealer, m.round, m.dealt], [1, 0, 1], 'the deal passes only when East loses it');
n++;
/* A draw passes the deal: winner is undefined, which is nobody's seat. */
m = play([undefined, undefined, undefined, undefined]);
assert.deepStrictEqual([m.round, m.dealt], [1, 0], 'four drawn hands finish the East round');
n++;

console.log(n + ' checks passed');
/* practice.mjs is a page module and leaves the loop alive; the checks are done. */
process.exit(0);

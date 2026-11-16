/* What the coach tells you to throw. Run: node test-coach.mjs */
import { recommend, handDistance, faanCeiling, direction } from './play/coach.mjs';
import assert from 'node:assert/strict';

/* 0-8 characters, 9-17 dots, 18-26 bamboo, 27-30 winds (E S W N), 31-33 dragons */
const complete = [0, 1, 2, 9, 10, 11, 18, 19, 20, 4, 4, 5, 5];

/* A hand one tile from ready with a white dragon hanging off it: the dragon goes. */
{
  const pick = recommend([...complete, 33], 0, []);
  assert.equal(pick.tile, 33);
  assert.equal(pick.distance, 0, 'throwing it leaves the hand one tile from complete');
  assert.match(pick.why, /lone honour/);
}

/* Nothing else is loose, so the hand gives up the tile that costs it least, and says so
   rather than claiming something is isolated when nothing is. */
{
  const pick = recommend([...complete, 5], 0, []);
  assert.ok(complete.includes(pick.tile) || pick.tile === 5);
  assert.doesNotMatch(pick.why, /lone|beside/);
}

/* With a faan minimum to clear, the opening discards invert ordinary tile efficiency.
   Seven bamboo is a flush lane, so the one dots tile goes first -- not the ninth bamboo
   that shape alone would throw, and not the lone wind either. Riichi and Mainland guides
   say to shed the honours first when flushing; the report calls that actively wrong here,
   because in Hong Kong the honours are the faan that lifts the flush over the floor. */
{
  const hand = [0, 2, 6, 9, 20, 22, 23, 25, 25, 25, 26, 28, 30, 32];
  /* No minimum, so a chicken hand pays and there is no lane to clear. What leaves is still
     the loosest thing in the hand -- a lone wind that pays nothing, three live tiles
     against eight for a two-sided shape -- and not the ninth bamboo sitting beside a pung,
     which is what counting improving draws on its own used to pick. */
  const plain = recommend(hand, 0, [], { minFaan: 0 });
  assert.equal(plain.tile, 28, 'the lone South, the loosest thing in the hand');
  const place = t => plain.ranked.findIndex(c => c.tile === t);
  assert.ok(place(26) > place(9), 'the ninth bamboo has a pung beside it; the dots has nothing');
  /* With nothing to clear, the coach is only answering how to get to mahjong: no lane to
     shed into, and the green dragon is not held back for a faan nobody needs. */
  assert.ok(plain.ranked.every(c => c.shed === 99), 'no lane without a minimum');
  assert.ok(plain.ranked.every(c => c.pays === 0), 'and no faan to protect');

  const steered = recommend(hand, 0, [], { minFaan: 3 });
  assert.equal(steered.direction.kind, 'half-flush');
  assert.equal(steered.tile, 9, 'the single dots tile is the shortest lane to clear');
  /* and now the characters go before the honours, which is the inversion itself */
  const seat = t => steered.ranked.findIndex(c => c.tile === t);
  assert.ok(seat(0) < seat(28), 'off-suit before lone winds');
  /* with a minimum, and only then, the dragon is held back behind the winds that pay
     nothing: it is the cheapest faan on the table and they are worth three tiles each */
  assert.ok(seat(32) > seat(28) && seat(32) > seat(30), 'the green dragon is kept longest');
  assert.equal(steered.ranked.find(c => c.tile === 32).pays, 1);
  assert.match(steered.why, /collecting bamboo/);
  /* the green dragon is the one faan source in the hand, so it is nowhere near the top */
  assert.ok(steered.ranked.findIndex(c => c.tile === 32) > 3, 'the dragon is a keeper');
}

/* The hand from the table, which is what sent us here: seven characters, three strays in
   two other suits, four lone honours and a red dragon among them. The coach was throwing
   a character and ranking the one dots tile eighth. */
{
  const hand = [0, 2, 3, 4, 4, 4, 6, 14, 18, 20, 28, 29, 30, 31];
  const pick = recommend(hand, 0, [], { minFaan: 3, melds: [] });
  assert.equal(pick.direction.kind, 'half-flush');
  assert.equal(pick.direction.suit, 0, 'characters');
  assert.equal(pick.tile, 14, 'the lone dots tile, the shortest suit out');
  const place = tile => pick.ranked.findIndex(c => c.tile === tile);
  assert.ok(place(18) < place(0) && place(20) < place(0), 'both bamboo go before any character');
  assert.ok(place(31) > place(14), 'the red dragon is not thrown before the strays');
  assert.ok(place(31) > place(28) && place(31) > place(29) && place(31) > place(30),
    'and not before the winds that pay nothing either');
  /* and with no minimum there is no lane to clear, so none of this applies */
  assert.equal(recommend(hand, 0, [], { minFaan: 0 }).direction.kind, 'half-flush');
}

/* A direction is only a direction in a suit the melds have not already closed. */
{
  const bamboo = [18, 19, 20, 22, 23, 24, 26, 26];
  /* nothing but bamboo in it, so the clean flush is still on */
  assert.equal(direction(bamboo, []).kind, 'full-flush');
  assert.equal(direction([...bamboo, 31], []).kind, 'half-flush', 'a dragon makes it mixed');
  assert.equal(direction(bamboo, [[0, 1, 2]]).kind, 'undecided', 'a characters run is down');
}

/* Tiles already on the table are not coming back: a lone honour with three gone is a
   deader hold than one with three live, and the coach says which it is. */
{
  const hand = [...complete, 33];
  assert.match(recommend(hand, 0, [33, 33]).why, /already out/);
  assert.doesNotMatch(recommend(hand, 0, []).why, /already out/);
}

/* Whatever it picks is a tile you actually hold, and the list behind it is ordered. */
{
  const hand = [0, 0, 3, 5, 9, 12, 13, 14, 20, 21, 27, 27, 31, 33];
  const pick = recommend(hand, 0, []);
  assert.ok(hand.includes(pick.tile));
  const distances = pick.ranked.map(c => c.distance);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.equal(pick.distance, Math.min(...distances));
  assert.ok(pick.runnerUp && pick.runnerUp.tile !== pick.tile);
}

/* An exposed set is three tiles of the hand already made. */
assert.ok(handDistance([0, 1, 2, 9, 10, 11, 4, 4, 5, 5], 1) <= handDistance([0, 1, 2, 9, 10, 11, 4, 4, 5, 5], 0));


/* ---- the faan a hand can still reach -------------------------------------------
   The melds decide it, because they cannot be taken back. */
{
  const chars = [0, 1, 2], dots = [9, 10, 11];
  const plain = [18, 19, 20, 22, 23, 24, 26, 26, 5];

  /* a run and a second suit face up: no flush, no all pungs, nothing left but a plain
     hand, which at a three-faan table cannot be declared at all */
  assert.equal(faanCeiling(plain, [chars, dots]), 1);

  /* one dragon pung is the whole of what such a hand pays -- a faan is a faan, and the
     faan for a plain hand is not collected on top of it */
  assert.equal(faanCeiling([...plain, 31, 31], [chars, dots]), 1);

  /* two of them, and it is still a faan short of a three-faan table */
  assert.equal(faanCeiling([...plain, 31, 31, 32, 32], [chars, dots]), 2);

  /* nothing face up yet: the hand is still free to go anywhere */
  assert.ok(faanCeiling(plain, []) >= 3, 'a closed hand keeps its routes');

  /* a pung down instead of a run leaves All Pungs alive */
  assert.ok(faanCeiling(plain, [[18, 18, 18]]) >= 3, 'no run laid down, so all pungs lives');

  /* the coach will not throw the tile that kills the last route to the minimum.
     One characters run is down, so characters is the only suit a flush can still use;
     the lone 5 of characters is the hand's only tile in it. */
  const stuck = [5, 18, 19, 20, 22, 23, 24, 26, 26, 9];
  const free = recommend(stuck, 1, [], { minFaan: 3, melds: [[0, 1, 2]] });
  assert.notEqual(free.tile, 5, 'throwing the last character would end the only flush left');
  assert.equal(free.blocked, false);

  /* and when every route really has shut, it says so instead of picking prettily */
  const dead = recommend(plain, 2, [], { minFaan: 3, melds: [chars, dots] });
  assert.equal(dead.blocked, true);
  assert.match(dead.why, /cannot be declared/);
}

console.log('coach: all checks passed');

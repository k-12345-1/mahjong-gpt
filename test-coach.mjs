/* What the coach tells you to throw. Run: node test-coach.mjs */
import { recommend, handDistance } from './play/coach.mjs';
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

/* With a faan minimum to clear, a hand that is nearly all one suit stops throwing that
   suit: the lone wind goes instead of the ninth bamboo. */
{
  const hand = [0, 2, 6, 9, 20, 22, 23, 25, 25, 25, 26, 28, 30, 32];
  assert.equal(recommend(hand, 0, [], { minFaan: 0 }).tile, 26);
  const steered = recommend(hand, 0, [], { minFaan: 3 });
  assert.equal(steered.tile, 28);
  assert.match(steered.why, /lone honour/);
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

console.log('coach: all checks passed');

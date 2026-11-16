// Standard four-set hand distance: -1 complete, 0 waiting for one tile.
export function handDistance(hand, exposed=0) {
  const counts=Array(34).fill(0);
  for(const tile of hand)counts[tile]++;
  let best=8;
  function search(start,sets,pairs,partials){
    while(start<34&&!counts[start])start++;
    if(start===34){
      best=Math.min(best,8-2*sets-Math.min(4-sets,partials)-pairs);
      return;
    }
    if(best===-1)return;
    function take(indices,nextSets,nextPairs,nextPartials){
      for(const i of indices)counts[i]--;
      search(start,nextSets,nextPairs,nextPartials);
      for(const i of indices)counts[i]++;
    }
    const n=start, suited=n<27;
    if(sets<4){
      if(counts[n]>=3)take([n,n,n],sets+1,pairs,partials);
      if(suited&&n%9<7&&counts[n+1]&&counts[n+2])take([n,n+1,n+2],sets+1,pairs,partials);
    }
    if(counts[n]>=2){
      if(!pairs)take([n,n],sets,1,partials);
      if(partials<4-sets)take([n,n],sets,pairs,partials+1);
    }
    if(partials<4-sets&&suited){
      if(n%9<8&&counts[n+1])take([n,n+1],sets,pairs,partials+1);
      if(n%9<7&&counts[n+2])take([n,n+2],sets,pairs,partials+1);
    }
    take([n],sets,pairs,partials);
  }
  search(0,exposed,0,0);
  return best;
}
export function discardChoices(hand,exposed,publicTiles){
  const seen=Array(34).fill(0);
  for(const tile of [...hand,...publicTiles])if(tile<34)seen[tile]++;
  const unique=[...new Set(hand)];
  const choices=unique.map(tile=>{
    const rest=hand.slice();rest.splice(rest.indexOf(tile),1);
    const distance=handDistance(rest,exposed);
    const improves=[];
    for(let draw=0;draw<34;draw++){
      const copies=Math.max(0,4-seen[draw]);
      if(copies&&handDistance([...rest,draw],exposed)<distance)improves.push({tile:draw,copies});
    }
    return {tile,distance,improves,copies:improves.reduce((total,item)=>total+item.copies,0)};
  });
  return choices.sort((a,b)=>a.distance-b.distance||b.copies-a.copies||a.tile-b.tile);
}
export function fanDirections(hand,melds,seatWind=27,roundWind=27){
  const tiles=[...hand,...melds.flat()];
  const counts=Array(34).fill(0);
  for(const tile of tiles)counts[tile]++;
  const values=[31,32,33,...new Set([seatWind,roundWind])];
  const made=values.filter(tile=>counts[tile]>=3);
  const pairs=values.filter(tile=>counts[tile]===2);
  const suits=[0,1,2].map(s=>tiles.filter(tile=>tile<27&&Math.floor(tile/9)===s).length);
  const dominant=suits.indexOf(Math.max(...suits));
  return {made,pairs,dominant,offSuit:suits.reduce((a,b)=>a+b,0)-suits[dominant]};
}

/* ---- the tile to throw ----------------------------------------------------------
   Shape decides it: the discard that leaves the hand closest to ready, and among the
   ones that tie, the one with the most tiles still unseen that would improve what is
   left. Fan only enters where the table has a minimum to clear -- under that a chicken
   hand pays, so the widest wait simply is the best hand. Where there is a minimum, a
   dragon pair or a suit the hand is nearly clean in is worth giving up some waits for,
   and the trade is made in waits so the two are comparable. */
const DRAGONS = [31, 32, 33];
const suitOf = tile => (tile < 27 ? Math.floor(tile / 9) : -1);

/* ---- can the hand still be declared? ----------------------------------------------
   Hong Kong is a minimum-constraint game. Four runs and a pair is one faan, and at a
   three-faan table that is not a cheap win -- it is not a win at all, and declaring it
   is a penalised false win. So faan is not a tiebreak to apply on top of shape, it is a
   legality test to apply before it.

   What settles it is the melds already on the table, because those tiles never come
   back. A run laid down ends All Pungs. A second suit ends both flushes. The ceiling is
   what is left after those doors have shut, and a route counts only where the tiles are
   already in hand: needing to draw two more of one dragon is a wish, not a route. */
export function faanCeiling(concealed, melds = [], opts = {}) {
  const { seatWind = 27, roundWind = 27 } = opts;
  const down = melds.flat();
  const all = [...concealed, ...down].filter(tile => tile < 34);
  const counts = Array(34).fill(0);
  for (const tile of all) counts[tile]++;

  const openChow = melds.some(m => m.length && !m.every(tile => tile === m[0]));
  const meldSuits = new Set(down.filter(tile => tile < 27).map(suitOf));
  const meldHonours = down.some(tile => tile >= 27);

  let shape = 0;
  for (const s of [0, 1, 2]) {
    if (meldSuits.size && !(meldSuits.size === 1 && meldSuits.has(s))) continue;
    if (!all.some(tile => suitOf(tile) === s)) continue;
    /* honours already face up rule out the clean flush but not the mixed one */
    shape = Math.max(shape, meldHonours ? 3 : 7);
  }
  if (!openChow) shape = Math.max(shape, 3);

  const pays = new Set([...DRAGONS, seatWind, roundWind]);
  const value = [...pays].filter(tile => counts[tile] >= 2).length;
  /* three dragons going at once is not three faan, it is the big hand; cheap insurance
     against the gate calling the best hand on the table dead */
  if (DRAGONS.filter(tile => counts[tile] >= 2).length === 3) shape = Math.max(shape, 8);

  /* every finished hand is worth one, and one more again if it was never opened */
  return Math.max(1, shape + value + (melds.length ? 0 : 1));
}

export function recommend(hand, exposed, publicTiles, opts = {}) {
  const { seatWind = 27, roundWind = 27, minFaan = 0, melds = [] } = opts;
  const scored = opts.choices || discardChoices(hand, exposed, publicTiles);
  if (!scored.length) return null;

  const counts = Array(34).fill(0);
  for (const tile of hand) if (tile < 34) counts[tile]++;
  const gone = Array(34).fill(0);
  for (const tile of publicTiles) if (tile < 34) gone[tile]++;

  const { dominant, offSuit } = fanDirections(hand, [], seatWind, roundWind);
  const pays = new Set([...DRAGONS, seatWind, roundWind]);
  const clean = offSuit <= 4;          /* close enough to a flush to be worth steering to */
  const cost = tile => !minFaan ? 0
    : (pays.has(tile) && counts[tile] >= 2 ? 8 : 0)
    + (clean && suitOf(tile) === dominant ? 5 : 0);

  /* Legality sorts above shape, and when nothing left is legal the coach says which wall
     the hand has run into rather than quietly recommending the prettiest dead hand. */
  const ranked = scored.map(c => {
    const rest = hand.slice(); rest.splice(rest.indexOf(c.tile), 1);
    const ceiling = faanCeiling(rest, melds, { seatWind, roundWind });
    return { ...c, ceiling, legal: !minFaan || ceiling >= minFaan, merit: c.copies - cost(c.tile) };
  }).sort((a, b) => (b.legal - a.legal) || a.distance - b.distance || b.merit - a.merit || a.tile - b.tile);
  const best = ranked[0];
  const blocked = !!minFaan && !ranked.some(c => c.legal);

  /* a tile with nothing built on it: no pair, and in a suit, no neighbour to run with */
  const alone = tile => counts[tile] === 1
    && (tile >= 27 || ![-2, -1, 1, 2].some(d => suitOf(tile + d) === suitOf(tile) && counts[tile + d]));

  const why =
    blocked ? 'this hand can no longer reach ' + minFaan + ' faan, so it cannot be declared -- play it out safely'
    : best.distance === -1 ? 'the hand is already complete'
    : alone(best.tile) && best.tile >= 27
      ? (gone[best.tile] >= 2 ? 'a lone honour, and most of the others are already out'
                              : 'a lone honour with nothing built on it')
    : alone(best.tile) ? 'nothing in your hand sits beside it'
    : minFaan && clean && suitOf(best.tile) >= 0 && suitOf(best.tile) !== dominant
      ? 'it is off the suit you are collecting'
    : best.copies ? best.copies + ' unseen tiles would improve what is left'
    : 'it costs the hand least';

  return { ...best, why, blocked, runnerUp: ranked[1] || null, ranked };
}

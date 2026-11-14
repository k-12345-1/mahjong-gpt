/* The end of a hand, played out on the table itself.
   Everything that is finished with turns face down -- the discards, and the hands that
   did not win -- and as they turn they settle to one size and one spacing, so what you
   are left with is an even table of backs rather than the board's own layout in green.
   The table then darkens, and each hand in turn comes up off it, lit from the side, with
   the tiles that earned each faan picked out one reason at a time.
   Nothing moves on its own: every step waits for a tap, so a hand can be read for as
   long as it takes to read it.
   The tiles you see are stand-ins: the real ones are measured, copied into a layer over
   the board and hidden, so nothing has to fight the grid they were laid out in. */

const BACK = 'tile-art/back.webp';
const GAP = .085;        /* the space between tiles, as a share of a tile's width */
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function endCurtain(root, rows) {
  const board = root && root.querySelector('.practice-board');
  if (!board || board.querySelector('.curtain') || !rows || !rows.length) return;
  const br = board.getBoundingClientRect();
  if (!br.width) return;

  const layer = document.createElement('div');
  layer.className = 'curtain';
  board.append(layer);

  /* the table itself, darkened, so the hand above it reads as being off the baize */
  const dim = document.createElement('div');
  dim.className = 'curtain-dim';
  layer.append(dim);

  /* A tile is copied at the size it is laid out at, not the size its box measures: the
     hands at the sides are turned a quarter turn, so their boxes read the other way
     round, and a copy made from those comes out stretched. The turn is carried over as
     a transform instead, which is also what the stand-in is flipped about. */
  const copy = im => {
    const r = im.getBoundingClientRect();
    const m = new DOMMatrixReadOnly(getComputedStyle(im).transform);
    const spin = Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI);
    const el = document.createElement('img');
    el.className = 'curtain-tile';
    el._face = im.getAttribute('src');
    el.src = el._face;
    el._w = im.offsetWidth || r.width;
    el._h = im.offsetHeight || r.height;
    el._spin = spin;
    el._base = spin ? 'rotate(' + spin + 'deg)' : '';
    el._cx = r.left + r.width / 2 - br.left;
    el._cy = r.top + r.height / 2 - br.top;
    el._x = el._cx - el._w / 2; el._y = el._cy - el._h / 2;
    place(el);
    el.style.transform = el._base || 'none';
    layer.append(el);
    return el;
  };
  const place = el => {
    el.style.left = el._x + 'px'; el.style.top = el._y + 'px';
    el.style.width = el._w + 'px'; el.style.height = el._h + 'px';
  };

  /* every run of tiles on the board, each of which will be evened out where it lies */
  const runs = [];
  /* A run's room is what its tiles actually cover, not the box they are laid out in: a
     tile turned a quarter turn hangs outside its own box, and measuring the box instead
     would have the whole table shrink to a size that was never needed. */
  /* A run with more tiles than its edge holds is scrolled, and what is scrolled out of
     it is not on the table: it is behind the edge of its own strip. Copying those would
     put tiles past the end of the board, because the copy keeps where they would have
     been rather than where they are seen. The count shows what was on the felt. */
  const onFelt = im => {
    const box = im.closest('.practice-exposed, .practice-river');
    if (!box || getComputedStyle(box).overflow === 'visible') return true;
    const b = box.getBoundingClientRect(), r = im.getBoundingClientRect();
    return r.right > b.left + .5 && r.left < b.right - .5
        && r.bottom > b.top + .5 && r.top < b.bottom - .5;
  };

  const take = el => {
    const imgs = [...el.querySelectorAll('img')].filter(onFelt);
    if (!imgs.length) return [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const im of imgs) {
      const r = im.getBoundingClientRect();
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    const tiles = imgs.map(copy);
    runs.push({ tiles, box: { x: x0 - br.left, y: y0 - br.top, w: x1 - x0, h: y1 - y0 } });
    return tiles;
  };

  const seats = [...board.querySelectorAll('.practice-seat')].map(s => ({
    p: Number((s.className.match(/\bp(\d)\b/) || [])[1]),
    tiles: [...s.querySelectorAll('.practice-hand, .practice-exposed')].flatMap(take),
  }));
  /* The discards are no longer anyone's once they are face down, and their four strips
     are thrown smaller than they are held, so each river keeps its own middle and its
     own rough shape and opens out around it to the one tile size. They stay in front
     of the seat that threw them rather than gathering into a single block. */
  for (const el of board.querySelectorAll('.practice-river')) {
    const imgs = [...el.querySelectorAll('img')].filter(onFelt);
    if (!imgs.length) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const im of imgs) {
      const r = im.getBoundingClientRect();
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    runs.push({ tiles: imgs.map(copy), river: true,
      box: { x: x0 - br.left, y: y0 - br.top, w: x1 - x0, h: y1 - y0 } });
  }
  const handOf = p => (seats.find(s => s.p === p) || { tiles: [] }).tiles;
  if (!runs.length) { layer.remove(); return; }
  board.classList.add('curtained');

  /* One tile size and one gap for the whole table. Start from the size the board uses
     and come down until every run still fits the space it already occupies -- a hand
     lies along its own edge, and the discards fill out as a block. */
  const all = runs.flatMap(r => r.tiles);
  const widths = all.map(t => t._w).sort((a, b) => a - b);
  const ratio = all.reduce((s, t) => s + t._h / t._w, 0) / all.length;
  for (const run of runs) {
    run.across = run.box.w >= run.box.h;
    /* Only a quarter turn swaps a tile's axes. The seat across the table lays its
       tiles at half a turn, which does not -- reading that as a quarter turn made its
       melds ask for their own height along the row, and shrank the whole table. */
    run.spin = Math.abs(run.tiles[0]._spin || 0) % 180 === 90;
  }
  /* how much of a run's own direction, and of the one across it, a tile takes up */
  const along = (run, W) => run.across ? (run.spin ? W * ratio : W) : (run.spin ? W : W * ratio);
  const wide = (run, W) => run.across ? (run.spin ? W : W * ratio) : (run.spin ? W * ratio : W);
  /* A tile keeps the size it was played at, and ONE gap is used everywhere -- the
     widest the tightest run can afford. A run of tiles that cannot sit shoulder to
     shoulder in its own strip is the only thing that brings the table down a size. */
  const strip = run => run.across ? run.box.w : run.box.h;
  const roomGap = (run, W) => {
    const n = run.tiles.length;
    if (run.river || n < 2) return Infinity;
    return (strip(run) - n * along(run, W)) / (n - 1);
  };
  const fits = W => runs.every(r => r.river || r.tiles.length * along(r, W) <= strip(r) + 1);
  let W = widths[Math.floor(widths.length / 2)];
  for (let i = 0; i < 80 && !fits(W); i++) W *= .95;
  const H = W * ratio;
  const gap = Math.max(0, Math.min(W * GAP, ...runs.map(r => roomGap(r, W))));
  for (const run of runs) {
    const n = run.tiles.length;
    /* A discard is thrown at the size it is held at, so a river is already right:
       it keeps every tile exactly where it fell, and only takes the common size. */
    if (!run.river) {
      const step = along(run, W) + gap;
      const len = n * along(run, W) + (n - 1) * gap;
      const a0 = (run.across ? run.box.x : run.box.y) + (strip(run) - len) / 2;
      const cross = (run.across ? run.box.y + run.box.h / 2 : run.box.x + run.box.w / 2);
      run.tiles.forEach((el, i) => {
        const a = a0 + i * step + along(run, W) / 2;
        el._cx = run.across ? a : cross;
        el._cy = run.across ? cross : a;
      });
    }
    run.tiles.forEach(el => {
      el._w = W; el._h = H;
      el._x = el._cx - W / 2; el._y = el._cy - H / 2;
    });
  }

  const caption = document.createElement('div');
  caption.className = 'curtain-say';
  caption.innerHTML = '<b></b><em></em>';
  layer.append(caption);
  /* The prompt goes under the hand, so the eye runs name, reason, tiles, then on. */
  const tap = document.createElement('div');
  tap.className = 'curtain-tap';
  tap.textContent = 'Tap to continue';
  layer.append(tap);
  const head = caption.querySelector('b'), reason = caption.querySelector('em');
  const say = (who, why) => {
    head.textContent = who || '';
    reason.textContent = why || '';
    const on = !!(who || why);
    caption.classList.toggle('in', on);
    const L = layer._lift;
    if (L) tap.style.top = (L.y0 + L.h + L.w * .34) + 'px';
    tap.classList.toggle('in', on && !!L);
  };

  /* One ring around the tiles a faan is counted on, rather than a box on each tile:
     the hand lies in a single row, so a faan is a span of it. */
  const ring = document.createElement('div');
  ring.className = 'curtain-ring';
  layer.append(ring);
  const circle = (tiles, at) => {
    const L = layer._lift, idx = (at || []).filter(i => tiles[i]);
    if (!L || !idx.length) { ring.classList.remove('in'); return; }
    const lo = Math.min(...idx), hi = Math.max(...idx);
    /* half the gap at most, so the ring stops short of its neighbours */
    const pad = Math.max(1, Math.min(L.w * .15, L.gap / 2 - 1));
    /* a rounded corner, not a pill: a pill's ends cut across the first and last tile */
    ring.style.borderRadius = (L.w * .3) + 'px';
    ring.style.left = (L.x0 + lo * (L.w + L.gap) - pad) + 'px';
    ring.style.top = (L.y0 - pad) + 'px';
    ring.style.width = ((hi - lo + 1) * L.w + (hi - lo) * L.gap + pad * 2) + 'px';
    ring.style.height = (L.h + pad * 2) + 'px';
    ring.classList.add('in');
  };

  /* Nothing happens until the screen is touched. The listener goes on the page rather
     than the table, because the table itself is redrawn from time to time and a listener
     left on it would go with it, and the sequence would wait for a tap that never came. */
  const tapped = () => new Promise(res => {
    const on = () => { root.removeEventListener('click', on); clearInterval(watch); res(); };
    /* If the board is redrawn under us the layer goes with it and the tap can never
       come. Letting the wait end there is what releases whoever is waiting on the
       count -- the table's own controls are held back until it finishes. */
    const watch = setInterval(() => { if (!layer.isConnected) on(); }, 400);
    root.addEventListener('click', on);
  });

  /* turning a tile over: it narrows to nothing, changes face, and opens out again --
     and on the way down it also takes its place in the even rank */
  const turn = async (tiles, to, settle) => {
    if (!tiles.length) return;
    const step = tiles.length > 20 ? 15 : 24;
    tiles.forEach((el, i) => setTimeout(() => {
      if (settle) {
        el.style.transition = 'transform .15s linear, left .5s ease, top .5s ease, width .5s ease, height .5s ease';
        place(el);
      } else {
        el.style.transition = 'transform .15s linear';
      }
      el.style.transform = (el._base + ' scaleX(0)').trim();
      setTimeout(() => {
        el.src = to === 'face' ? el._face : BACK;
        el.style.transform = el._base || 'none';
      }, 165);
    }, i * step));
    await wait(tiles.length * step + (settle ? 620 : 400));
  };

  /* a hand lifted off the table: one row across the middle, big enough to read */
  /* Transforms turn about the middle of a tile, so a hand is lifted by moving centres --
     and it comes up square, whichever way round it was lying on the table. */
  const lift = tiles => {
    const n = tiles.length || 1;
    /* wide enough apart that the ring round a set can sit between two tiles rather
       than across the one beside it */
    const gap = Math.max(7, br.width * .013);
    const w = Math.min(br.height * .165, (br.width * .88 - (n - 1) * gap) / n);
    const h = w * ratio;
    const x0 = (br.width - (n * w + (n - 1) * gap)) / 2, y0 = br.height * .44;
    layer._lift = { x0, y0, w, h, gap };
    tiles.forEach((el, i) => {
      el.classList.add('up');
      el.style.transition = 'transform .62s cubic-bezier(.22,.72,.2,1)';
      el.style.transform = 'translate(' + (x0 + i * (w + gap) + w / 2 - el._cx) + 'px,'
        + (y0 + h / 2 - el._cy) + 'px) scale(' + (w / el._w) + ',' + (h / el._h) + ')';
    });
  };
  const putBack = tiles => tiles.forEach(el => {
    el.style.transition = 'transform .55s cubic-bezier(.22,.72,.2,1)';
    el.style.transform = el._base || 'none';
    el.classList.remove('up');
  });

  /* 1. the discards and every hand that did not win turn face down and even up */
  const champion = rows[0] && rows[0].won ? handOf(rows[0].p) : [];
  const up = new Set(champion);
  const down = all.filter(el => !up.has(el));
  requestAnimationFrame(() => dim.classList.add('in'));
  await turn(down, 'back', true);
  /* the winner's own hand evens up too, without turning over */
  champion.forEach(el => {
    el.style.transition = 'left .5s ease, top .5s ease, width .5s ease, height .5s ease';
    place(el);
  });
  await wait(560);

  /* The call. The table has just turned itself face down and gone dark, and this is
     what it went dark for -- said once, before any hand is lifted. A drawn hand has
     nothing to call, so it goes straight on to what each seat was holding. */
  const champ = rows[0] && rows[0].won ? rows[0] : null;
  if (champ) {
    const call = document.createElement('div');
    call.className = 'curtain-call';
    call.innerHTML = '<b>Mahjong</b>';
    layer.append(call);
    await wait(60);
    call.classList.add('in');
    await wait(1450);
    call.classList.remove('in');
    await wait(460);
    call.remove();
  }

  /* 2. each hand comes up in turn and shows what it was worth, a reason at a time.
     The first one does not wait to be asked for: the table has just turned itself
     over, so the next thing to look at should already be on its way up. */
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k], tiles = handOf(row.p);
    if (!tiles.length) continue;
    if (k > 0 || !up.size) await turn(tiles, 'face');
    lift(tiles);
    const worth = row.faan ? row.score : '0 faan';
    /* The hand that won says so: the call named nobody, so the name lands here. */
    const who = row.won ? row.name + ' · Mahjong · ' + worth : row.name + ' · ' + worth;
    say(who, '');
    await wait(560);
    const reasons = (row.wins && row.wins.length) ? row.wins
      : [{ why: 'Nothing here scores' + (row.note ? ' — ' + row.note : ''), faan: 0, at: [] }];
    for (const why of reasons) {
      circle(tiles, why.at);
      say(who, why.faan ? why.why + ' — ' + why.faan + ' faan' : why.why);
      await tapped();
      circle(tiles, []);
      await wait(140);
    }
    putBack(tiles);
    await wait(560);
    say('', '');
    await turn(tiles, 'back');
  }
}

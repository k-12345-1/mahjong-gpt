/* Washing the tiles. Between one hand and the next the table is mixed face down, which
   at a real table is the noisy part and the part that tells you a new hand is coming.
   The tiles already on the felt are copied into a layer over the board, turned over, and
   pushed around it for a few seconds; the board beneath is hidden while they move, so
   what you watch is the hand you just played being broken up. Nothing here touches the
   game: it resolves when it is done and the deal happens after. */

const BACK = 'tile-art/back.webp';
const COUNT = 52;          /* enough to read as a table full of tiles */
const STEP = 620;          /* how long one push across the felt takes */

export function washTiles(board, ms = 5000) {
  return new Promise(resolve => {
    const done = () => { try { finish(); } catch { /* already gone */ } resolve(); };
    let finish = () => {};
    if (!board) { resolve(); return; }

    /* Someone who has asked for less movement gets the pause without the milling. */
    let reduced = false;
    try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no mq */ }
    if (reduced) { setTimeout(resolve, 400); return; }

    const br = board.getBoundingClientRect();
    if (!br.width) { resolve(); return; }

    /* Start from where the tiles actually are, so they look like the ones being mixed
       rather than a new set thrown onto the table. */
    const seen = [...board.querySelectorAll('.practice-seat img, .practice-river img')]
      .map(im => im.getBoundingClientRect())
      .filter(r => r.width);
    const probe = seen[0];
    const w = probe ? probe.width : br.width * .045;
    const h = probe ? probe.height : w * 34 / 26;

    const layer = document.createElement('div');
    layer.className = 'wash';
    layer.setAttribute('aria-hidden', 'true');
    board.append(layer);
    board.classList.add('washing');

    /* Kept off the rim so a tile never looks like it is sliding off the table. */
    const edge = Math.max(w, h) * .7;
    const spanX = Math.max(0, br.width - edge * 2 - w);
    const spanY = Math.max(0, br.height - edge * 2 - h);
    const place = () => ({
      x: edge + Math.random() * spanX,
      y: edge + Math.random() * spanY,
      r: (Math.random() - .5) * 54,
    });

    const tiles = [];
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('img');
      el.src = BACK; el.alt = ''; el.className = 'wash-tile';
      el.style.width = w + 'px'; el.style.height = h + 'px';
      const from = seen[i];
      const x = from ? from.left - br.left : edge + Math.random() * spanX;
      const y = from ? from.top - br.top : edge + Math.random() * spanY;
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      layer.append(el);
      tiles.push(el);
    }

    const push = () => {
      for (const el of tiles) {
        const p = place();
        el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) rotate(' + p.r + 'deg)';
      }
    };
    /* one frame at the old places first, so the first push is seen as movement */
    const first = requestAnimationFrame(push);
    const again = setInterval(push, STEP);
    const end = setTimeout(done, ms);

    finish = () => {
      cancelAnimationFrame(first); clearInterval(again); clearTimeout(end);
      layer.remove();
      board.classList.remove('washing');
      finish = () => {};
    };
  });
}

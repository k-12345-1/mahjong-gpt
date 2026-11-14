// Decorative canvas overlay. The return value removes the layer and listeners.
export function mountDragonSwim(hero, {
  imageUrl = new URL('./dragon.png', import.meta.url).href,
  duration = 7,
  pause = 0.6,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'dragon-swim';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const image = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf, points, length, scale, start;
  let disposed = false;
  const observer = new ResizeObserver(resize);
  hero.append(canvas);
  observer.observe(hero);

  function resize() {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(h * .89 / 1536, w * .55 / 1024);

    // Head enters at lower right, crosses the title, then turns up and out.
    const controls = [[1.32*w, 1.07*h], [.62*w, .99*h],
      [.27*w, .74*h], [.36*w, -1.07*h]];
    points = [];
    length = 0;
    for (let i = 0; i <= 180; i++) {
      const u = i / 180;
      const v = 1 - u;
      const weights = [v**3, 3*v*v*u, 3*v*u*u, u**3];
      const x = controls.reduce((sum, p, j) => sum + p[0] * weights[j], 0);
      const y = controls.reduce((sum, p, j) => sum + p[1] * weights[j], 0);
      const prev = points.at(-1);
      if (prev) length += Math.hypot(x - prev.x, y - prev.y);
      points.push({x, y, d:length});
    }
  }

  function at(distance) {
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].d < distance) lo = mid;
      else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const span = b.d - a.d;
    const f = (distance - a.d) / span;
    return {x:a.x + (b.x-a.x)*f, y:a.y + (b.y-a.y)*f,
      dx:(b.x-a.x)/span, dy:(b.y-a.y)/span};
  }

  function section(row, headDistance, time) {
    const p = at(headDistance - row * scale);
    const progress = row / image.naturalHeight;
    const wave = 115 * scale * progress**1.35 * Math.sin(time * 4.8 - progress * 9);
    return {x:p.x - p.dy * wave, y:p.y + p.dx * wave};
  }

  function frame(now) {
    start ??= now;
    const t = ((now - start) / 1000) % (duration + pause);
    ctx.clearRect(0, 0, hero.clientWidth, hero.clientHeight);
    if (t < duration && scale > 0 && length > 0) {
      const distance = (length + image.naturalHeight * scale) * t / duration;
      const w = image.naturalWidth;
      const h = image.naturalHeight;
      for (let row = 0; row < h; row += 12) {
        const size = Math.min(12, h - row);
        const a = section(row, distance, t);
        const b = section(row + size, distance, t);
        const dx = (b.x-a.x)/size;
        const dy = (b.y-a.y)/size;
        const unit = Math.hypot(dx, dy);
        ctx.save();
        ctx.transform(dy/unit*scale, -dx/unit*scale, dx, dy, a.x, a.y);
        const slice = Math.min(size + 2, h - row);
        ctx.drawImage(image, 0, row, w, slice, -w * .49, 0, w, slice);
        ctx.restore();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function syncMotion() {
    cancelAnimationFrame(raf);
    start = undefined;
    ctx.clearRect(0, 0, hero.clientWidth, hero.clientHeight);
    if (reduced.matches || !image.naturalWidth || disposed) return;
    resize();
    raf = requestAnimationFrame(frame);
  }

  reduced.addEventListener('change', syncMotion);
  image.onload = syncMotion;
  image.src = imageUrl;
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    reduced.removeEventListener('change', syncMotion);
    image.onload = null;
    canvas.remove();
  };
}

/* Drives the real mountDragonSwim physics headlessly and reports how much of the body
   leaves the frame. The renderer calls ctx.transform(..,..,..,..,x,y) once per chain
   segment per frame, so the chain positions can be read straight off those calls. */
const fs = require('fs');

function loadModule(src) {
  const i = src.indexOf('function mountDragonSwim');
  const j = src.indexOf('\n}\n', src.indexOf('return () => {', i)) + 3;
  return src.slice(i, j);
}

function run({ w, h, seconds = 240, fps = 60, seed = 1, file = 'index.html', patch = [] }) {
  let rnd = seed;
  const random = () => (rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648;

  const pts = [];
  let drawingThisFrame = [];
  const frames = [];
  const ctxStub = {
    setTransform() {}, save() {}, restore() {},
    transform(a, b, c, d, e, f) { drawingThisFrame.push([e, f]); },
    drawImage() {}, rotate() {},
    clearRect() { if (drawingThisFrame.length) { frames.push(drawingThisFrame); drawingThisFrame = []; } },
  };
  const makeCanvas = () => ({ width: 0, height: 0, className: '', style: {},
    setAttribute() {}, remove() {}, getContext: () => ctxStub });

  let rafQueue = [];
  const sandbox = {
    Math: Object.create(Math),
    document: { createElement: makeCanvas },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => { rafQueue = []; },
    window: { devicePixelRatio: 2 },
  };
  sandbox.Math.random = random;
  const Image = function () { this.naturalWidth = 1774; this.naturalHeight = 887;
    Object.defineProperty(this, 'src', { set() { if (this.onload) this.onload(); } }); };
  sandbox.Image = Image;

  const src = fs.readFileSync(file, 'utf8');
  let mod = loadModule(src);
  for (const [from, to] of patch) {
    if (!mod.includes(from)) throw new Error('patch anchor missing: ' + from.slice(0, 60));
    mod = mod.split(from).join(to);
  }
  const factory = new Function(
    'Math', 'document', 'matchMedia', 'ResizeObserver',
    'requestAnimationFrame', 'cancelAnimationFrame', 'window', 'Image',
    mod + '\nreturn mountDragonSwim;');
  const mount = factory(sandbox.Math, sandbox.document, sandbox.matchMedia,
    sandbox.ResizeObserver, sandbox.requestAnimationFrame, sandbox.cancelAnimationFrame,
    sandbox.window, sandbox.Image);

  const hero = { clientWidth: w, clientHeight: h, append() {},
    classList: { toggle() {} } };
  mount(hero, { onState() {} });
  /* drive the real rAF loop at a fixed step */
  const dt = 1000 / fps;
  let t = 0;
  for (let n = 0; n < seconds * fps; n++) {
    const q = rafQueue; rafQueue = [];
    sandbox.requestAnimationFrame = (fn) => { rafQueue.push(fn); return 1; };
    if (!q.length) break;
    t += dt;
    for (const fn of q) fn(t);
  }
  return { frames, hero };
}
module.exports = { run, loadModule };

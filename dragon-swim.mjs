import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

export const swimDefaults = Object.freeze({
  speed: 1.7, waveAmplitude: .54, waveFrequency: .55,
  turnRadius: 2.45, modelScale: 3.45,
});

const sections = 64;
const flightUp = new THREE.Vector3(0, .75, 1).normalize();
const dorsal = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

// Center of the body in this asset's local Y/Z plane, from neck to tail.
// The GLB faces +Z, is Y-up, and contains one unskinned mesh.
const spineProfile = [
  [.38, .49], [.31, .42], [.22, .34], [.13, .24], [.091, .13],
  [.09, .02], [.116, -.09], [.186, -.19], [.276, -.29],
  [.321, -.39], [.294, -.49], [.221, -.57], [.145, -.65],
  [.111, -.74], [.131, -.81],
].map(([y, z]) => new THREE.Vector3(0, y, z));
const restSpine = new THREE.CatmullRomCurve3(spineProfile);
const spineLength = restSpine.getLength();
const bindPoints = restSpine.getSpacedPoints(sections - 1);
const bindUp = bindPoints.map((_, i) => {
  const forward = bindPoints[Math.max(i - 1, 0)].clone()
    .sub(bindPoints[Math.min(i + 1, sections - 1)]).normalize();
  return forward.cross(new THREE.Vector3(1, 0, 0)).normalize();
});

function bindMesh(geometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const section = new Float32Array(positions.count);
  const local = new Float32Array(positions.count * 3);
  const localNormal = new Float32Array(positions.count * 3);
  const up = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const origin = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);
    // Slice the rest mesh in longitudinal order. Nearest-point binding can
    // assign adjacent vertices to opposite sides of a curve in the sculpt.
    let low = 0, high = sections - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (point.z < bindPoints[middle].z) low = middle;
      else high = middle;
    }
    const front = bindPoints[low].z, back = bindPoints[high].z;
    let index = low + clamp((front - point.z) / (front - back), 0, 1);
    const tuftBlend = THREE.MathUtils.smoothstep(-point.z, .75, .81);
    index = THREE.MathUtils.lerp(index, sections - 1, tuftBlend);
    const lower = Math.min(Math.floor(index), sections - 2);
    const blend = index - lower;
    origin.copy(bindPoints[lower]).lerp(bindPoints[lower + 1], blend);
    up.copy(bindUp[lower]).lerp(bindUp[lower + 1], blend).normalize();
    forward.set(0, -up.z, up.y);
    point.sub(origin);
    section[i] = index;
    local.set([point.x, point.dot(up), point.dot(forward)], i * 3);
    localNormal.set([normal.x, normal.dot(up), normal.dot(forward)], i * 3);
  }
  geometry.setAttribute('swimSection', new THREE.BufferAttribute(section, 1));
  geometry.setAttribute('swimOffset', new THREE.BufferAttribute(local, 3));
  geometry.setAttribute('swimNormal', new THREE.BufferAttribute(localNormal, 3));
}

function colorSculpt(geometry) {
  const positions = geometry.getAttribute('position');
  const offsets = geometry.getAttribute('swimOffset');
  const colors = new Float32Array(positions.count * 3);
  const scarlet = new THREE.Color('#c31908');
  const ridge = new THREE.Color('#fc4e32');
  const cream = new THREE.Color('#e7b69c');
  const gold = new THREE.Color('#dc9b36');
  const color = new THREE.Color();
  const smooth = THREE.MathUtils.smoothstep;
  const ivory = new THREE.Color('#f8eddb');
  for (let i = 0; i < positions.count; i++) {
    const side = Math.abs(positions.getX(i));
    const height = positions.getY(i);
    const depth = positions.getZ(i);
    const along = .95 - depth;
    const relief = offsets.getY(i);
    const dorsal = smooth(relief, .025, .17) * smooth(along, .47, .73);
    // Paint around the cross-section so cream wraps onto the visible flank.
    const underside = -relief / Math.max(.001, Math.hypot(side, relief));
    const belly = smooth(underside, -.04, .34) * smooth(along, .40, .57)
      * (1 - smooth(along, 1.74, 1.83)) * (1 - smooth(side, .12, .18))
      * smooth(relief, -.19, -.14);
    const jaw = (1 - smooth(height, .28, .315)) * (1 - smooth(along, .19, .32));
    const muzzle = (1 - smooth(along, .10, .17)) * smooth(height, .31, .36);
    const horns = smooth(height, .51, .58) * (1 - smooth(along, .52, .62))
      * smooth(along, .26, .33);
    const talons = (1 - smooth(height, .028, .072)) * smooth(side, .075, .115);
    color.copy(scarlet).lerp(ridge, dorsal * .62);
    color.lerp(cream, belly);
    color.lerp(ivory, Math.max(jaw * .95, muzzle * .76));
    color.lerp(gold, Math.max(horns, talons));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function deformMaterial(material, frameTexture) {
  material.onBeforeCompile = shader => {
    shader.uniforms.swimFrames = { value: frameTexture };
    shader.vertexShader = `
      uniform highp sampler2D swimFrames;
      attribute float swimSection;
      attribute vec3 swimOffset;
      attribute vec3 swimNormal;
      vec4 frameAt(int row) {
        int i = min(int(swimSection), ${sections - 2});
        return mix(texelFetch(swimFrames, ivec2(i,row),0),
                   texelFetch(swimFrames, ivec2(i+1,row),0), swimSection-float(i));
      }
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', `
        vec4 centerAndScale = frameAt(0);
        vec3 right = normalize(frameAt(1).xyz);
        vec3 up = normalize(frameAt(2).xyz);
        vec3 forward = normalize(cross(right,up));
        up = cross(forward,right);
        mat3 swimBasis = mat3(right,up,forward);
        vec3 objectNormal = swimBasis * swimNormal;
      `)
      .replace('#include <begin_vertex>', `
        vec3 transformed = centerAndScale.xyz + swimBasis * swimOffset * centerAndScale.w;
      `);
  };
  material.customProgramCacheKey = () => 'mahjong-swim-v1';
}

export class SwimPath {
  constructor(halfWidth, turnRadius, random) {
    this.width = halfWidth;
    this.turnRadius = turnRadius;
    this.random = random;
    this.side = -1;
    this.knots = [];
    this.samples = [];
    this.addSweep();
    const entry = this.knots[0];
    this.knots.unshift(
      entry.clone().add(new THREE.Vector3(-halfWidth * .25, 0, 0)),
      entry.clone().add(new THREE.Vector3(-halfWidth * .13, 0, 0)),
    );
    this.addSweep();
    this.segment = 0;
    while (this.samples.length < 100) this.appendSegment();
  }

  addSweep() {
    const start = this.side;
    const width = this.width;
    const radius = Math.min(this.turnRadius, width * .48);
    const y = (this.random() - .5) * 5.8;
    const angle = (this.random() - .5) * 4.0;
    const bend = y > 0 ? -1 : 1;
    // Keep the outer control point inside the viewport. The head stays
    // visible around the turn even if the larger silhouette grazes an edge.
    const edge = width * (.90 + .07 * this.random()) - radius;
    const endY = clamp(y + angle, -3.6, 3.6);
    const turnY = clamp(endY + bend * radius * 1.55, -4.35, 4.35);
    this.knots.push(
      new THREE.Vector3(start * width * .72, y, -.38 * y),
      new THREE.Vector3(-start * width * .42, (y + endY) * .5, -.19 * (y + endY)),
      new THREE.Vector3(-start * edge, endY, -.38 * endY),
      new THREE.Vector3(-start * (edge + radius), (endY + turnY) * .5, -.19 * (endY + turnY)),
      new THREE.Vector3(-start * edge, turnY, -.38 * turnY),
    );
    this.side *= -1;
  }

  appendSegment() {
    if (this.segment + 3 >= this.knots.length) this.addSweep();
    const [a, b, c, d] = this.knots.slice(this.segment, this.segment + 4);
    for (let j = this.samples.length === 0 ? 0 : 1; j <= 40; j++) {
      const t = j / 40;
      const t2 = t * t, t3 = t2 * t;
      const point = a.clone().multiplyScalar((1 - t) ** 3 / 6)
        .addScaledVector(b, (4 - 6 * t2 + 3 * t3) / 6)
        .addScaledVector(c, (1 + 3 * t + 3 * t2 - 3 * t3) / 6)
        .addScaledVector(d, t3 / 6);
      const previous = this.samples.at(-1);
      this.samples.push({ point, distance: previous ? previous.distance + point.distanceTo(previous.point) : 0 });
    }
    this.segment++;
  }

  at(distance, output) {
    while (this.samples.at(-1).distance < distance) this.appendSegment();
    let low = 0, high = this.samples.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (this.samples[middle].distance < distance) low = middle;
      else high = middle;
    }
    const a = this.samples[low], b = this.samples[high];
    return output.copy(a.point).lerp(b.point, (distance - a.distance) / (b.distance - a.distance));
  }

  discardBefore(distance) {
    if (this.samples.length < 400) return;
    const first = this.samples.findIndex(sample => sample.distance > distance);
    if (first > 1) this.samples.splice(0, first - 1);
    if (this.segment > 30) {
      this.knots.splice(0, this.segment);
      this.segment = 0;
    }
  }
}

export async function mountDragonSwim(hero, {
  modelUrl = new URL('./dragon.glb', import.meta.url).href,
  tuning = {}, random = Math.random, autoplay = true, signal,
} = {}) {
  const options = { ...swimDefaults, ...tuning };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // This hero works as a complete static layout when motion is reduced.
  if (reduced.matches || signal?.aborted) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 60);
  camera.position.z = 20;
  scene.add(new THREE.HemisphereLight(0xffedd9, 0x754b46, 2.2));
  const key = new THREE.DirectionalLight(0xffddbd, 2.5);
  key.position.set(-5, 7, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.3);
  rim.position.set(4, -3, 4);
  scene.add(rim);
  const data = new Float32Array(sections * 3 * 4);
  const texture = new THREE.DataTexture(data, sections, 3, THREE.RGBAFormat, THREE.FloatType);
  const canvas = renderer.domElement;
  canvas.className = 'dragon-swim-layer';
  canvas.setAttribute('aria-hidden', 'true');
  const resources = new Set();
  let raf = 0, last = 0, disposed = false;
  let width = 5, scale = options.modelScale, distance = 0, time = 0, path;
  const resize = new ResizeObserver(() => size());
  const stop = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
  const onMotion = () => {
    canvas.hidden = reduced.matches;
    if (reduced.matches) stop();
    else if (autoplay && !disposed && !raf) raf = requestAnimationFrame(frame);
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    resize.disconnect();
    reduced.removeEventListener('change', onMotion);
    signal?.removeEventListener('abort', dispose);
    canvas.remove();
    for (const resource of resources) resource.dispose();
    texture.dispose();
    renderer.dispose();
  }
  signal?.addEventListener('abort', dispose, { once: true });
  try {
    const { scene: dragon } = await new GLTFLoader().loadAsync(modelUrl);
    dragon.traverse(mesh => {
      if (!mesh.isMesh) return;
      resources.add(mesh.geometry);
      for (const material of [].concat(mesh.material)) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        material.color.set(0xffffff);
        material.vertexColors = true;
        deformMaterial(material, texture);
      }
      bindMesh(mesh.geometry);
      colorSculpt(mesh.geometry);
      mesh.frustumCulled = false;
    });
    if (disposed) {
      for (const resource of resources) resource.dispose();
      return null;
    }
    scene.add(dragon);
  } catch (error) {
    dispose();
    throw error;
  }

  const centers = Array.from({ length: sections }, () => new THREE.Vector3());
  const waveSamples = Array.from({ length: sections * 5 }, () => new THREE.Vector3());
  const waveArc = new Float64Array(waveSamples.length);
  const pathAhead = new THREE.Vector3();
  const pathBehind = new THREE.Vector3();
  const waveDirection = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  function size() {
    const { clientWidth: w, clientHeight: h } = hero;
    if (!w || !h) return;
    width = 5 * w / h;
    camera.left = -width;
    camera.right = width;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
    const nextScale = options.modelScale * clamp(width / 5, .55, 1);
    if (!path) {
      scale = nextScale;
      path = new SwimPath(width, options.turnRadius, random);
      distance = spineLength * scale + .75;
    } else {
      // Preserve the current path during browser chrome resize and use the new
      // viewport for upcoming sweeps. Retain the old history for the tail.
      path.width = width;
    }
    scale = nextScale;
    draw();
  }
  function draw() {
    if (!path || disposed || reduced.matches) return;
    const length = spineLength * scale;
    const spacing = length / (sections - 1);
    // Build the entire waved curve first, then sample its arc length. This
    // avoids a sequential length correction that can amplify a local fold.
    for (let i = 0; i < waveSamples.length; i++) {
      const fraction = 1.30 * i / (waveSamples.length - 1);
      const along = distance - length * fraction;
      const point = path.at(along, waveSamples[i]);
      path.at(along + .10, pathAhead);
      path.at(along - .10, pathBehind);
      tangent.copy(pathAhead).sub(pathBehind).normalize();
      // A transverse wave stays vertical on horizontal passes and eases
      // naturally through steep turns without folding back along the path.
      waveDirection.copy(dorsal).addScaledVector(tangent, -tangent.dot(dorsal));
      const amplitude = options.waveAmplitude * (.55 + .45 * Math.min(fraction, 1) ** 1.3);
      const tip = clamp((fraction - .82) / .18, 0, 1);
      const phase = time * options.waveFrequency - 1.12 * (fraction - .075 * tip ** 2);
      point.addScaledVector(waveDirection, amplitude * Math.sin(2 * Math.PI * phase));
      if (i) waveArc[i] = waveArc[i - 1] + point.distanceTo(waveSamples[i - 1]);
    }
    let sample = 1;
    for (let i = 0; i < sections; i++) {
      const target = Math.min(i * spacing, waveArc.at(-1));
      while (waveArc[sample] < target) sample++;
      const span = waveArc[sample] - waveArc[sample - 1];
      const blend = span > 0 ? (target - waveArc[sample - 1]) / span : 0;
      centers[i].copy(waveSamples[sample - 1]).lerp(waveSamples[sample], blend);
    }
    // A narrower resize can leave previously queued points outside the new
    // viewport. Translate the whole pose together until the new sweeps arrive.
    const head = centers[0];
    const shiftX = clamp(head.x, -.96 * width, .96 * width) - head.x;
    for (const center of centers) center.x += shiftX;
    for (let i = 0; i < sections; i++) {
      const span = 2;
      tangent.copy(centers[Math.max(i - span, 0)])
        .sub(centers[Math.min(i + span, sections - 1)]).normalize();
      right.crossVectors(flightUp, tangent).normalize();
      up.crossVectors(tangent, right).normalize();
      const p = centers[i], offset = i * 4;
      data.set([p.x, p.y, p.z, scale], offset);
      data.set([right.x, right.y, right.z, 0], offset + sections * 4);
      data.set([up.x, up.y, up.z, 0], offset + sections * 8);
    }
    texture.needsUpdate = true;
    renderer.render(scene, camera);
  }
  function advance(seconds) {
    if (!path || disposed) return;
    time += seconds;
    distance += options.speed * seconds;
    path.discardBefore(distance - spineLength * scale - 10);
    draw();
  }
  function frame(now) {
    if (last) advance(Math.min((now - last) / 1000, .05));
    last = now;
    raf = requestAnimationFrame(frame);
  }
  hero.append(canvas);
  resize.observe(hero);
  size();
  reduced.addEventListener('change', onMotion);
  onMotion();
  return { dispose, advance, getCenters: () => centers.map(p => p.toArray()) };
}

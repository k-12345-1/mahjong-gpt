import * as THREE from './vendor/three/three.module.min.js';
import { SwimPath, swimDefaults } from './dragon-swim.mjs';

const strips = 96;
const headPivot = .72;
const pivotY = .49;
const flightUp = new THREE.Vector3(0, .75, 1).normalize();
const screenUp = new THREE.Vector3(0, 1, 0);

export async function mountGoldDragon(hero, { signal } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (signal?.aborted || reduced.matches) return;

  const image = new Image();
  image.src = new URL('./gold-dragon.png', import.meta.url).href;
  await image.decode();
  if (signal?.aborted) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return;
  }
  const canvas = renderer.domElement;
  canvas.className = 'dragon-swim-layer';
  canvas.setAttribute('aria-hidden', 'true');
  hero.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, .1, 10000);
  camera.position.z = 5000;
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array((strips + 1) * 6);
  const uv = [], triangles = [];
  for (let i = 0; i <= strips; i++) {
    uv.push(i / strips, 1, i / strips, 0);
    if (i < strips) {
      const j = i * 2;
      triangles.push(j, j + 1, j + 2, j + 2, j + 1, j + 3);
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(triangles);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, alphaTest: .07, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  let width, height, request = 0, previous, time = 0, distance, path;
  const sections = Array.from({ length: strips + 1 }, () => new THREE.Vector3());
  const head = new THREE.Vector3(), heading = new THREE.Vector3();
  const ahead = new THREE.Vector3(), behind = new THREE.Vector3(), direction = new THREE.Vector3();
  const transverse = new THREE.Vector3(), lateral = new THREE.Vector3(), up = new THREE.Vector3();

  function headingAt(along, result) {
    path.at(along + .11, ahead);
    path.at(along - .11, behind);
    return result.copy(ahead).sub(behind).normalize();
  }

  function draw() {
    if (!width || !height) return;
    const pixels = height / 10;
    const halfWidth = width / (2 * pixels);
    const size = Math.min(width * (width < 600 ? .74 : .49), height * 1.06);
    const scale = size / image.naturalWidth;
    const worldSize = size / pixels;
    if (!path) {
      path = new SwimPath(halfWidth, swimDefaults.turnRadius, Math.random);
      distance = headPivot * worldSize + .75;
    }
    path.width = halfWidth;
    path.discardBefore(distance - worldSize - 10);
    path.at(distance, head);
    headingAt(distance, heading);
    const phase = time * swimDefaults.waveFrequency;
    transverse.copy(screenUp).addScaledVector(heading, -heading.y);
    head.addScaledVector(transverse, swimDefaults.waveAmplitude * .55 * Math.sin(2 * Math.PI * phase));
    for (let i = 0; i <= strips; i++) {
      const lag = headPivot - i / strips;
      const point = sections[i];
      if (lag <= 0) {
        point.copy(head).addScaledVector(heading, -lag * worldSize);
      } else {
        const fraction = lag / headPivot;
        const along = distance - lag * worldSize;
        path.at(along, point);
        headingAt(along, direction);
        transverse.copy(screenUp).addScaledVector(direction, -direction.y);
        const amplitude = swimDefaults.waveAmplitude * (.55 + .45 * fraction ** 1.3);
        point.addScaledVector(transverse, amplitude * Math.sin(2 * Math.PI * (phase - 1.05 * fraction)));
      }
    }

    // Keep the face inside the hero even while its heading changes at an edge.
    const snout = sections[strips];
    const left = Math.min(head.x, snout.x), right = Math.max(head.x, snout.x);
    const margin = Math.min(.38, halfWidth * .15);
    const shiftX = Math.max(0, -halfWidth + margin - left)
      - Math.max(0, right - halfWidth + margin);
    const faceHeight = size * .17 / pixels;
    const low = Math.min(head.y, snout.y), high = Math.max(head.y, snout.y);
    const shiftY = Math.max(0, -5 + faceHeight - low) - Math.max(0, high - 5 + faceHeight);

    // One indexed surface shares the edges between neighboring strips.
    // This keeps the illustration continuous where the curve tightens.
    const imageHeight = image.naturalHeight * scale;
    for (let i = 0; i <= strips; i++) {
      const point = sections[i];
      direction.copy(sections[Math.min(strips, i + 2)])
        .sub(sections[Math.max(0, i - 2)]).normalize();
      if (i / strips >= headPivot) direction.copy(heading);
      lateral.crossVectors(flightUp, direction).normalize();
      up.crossVectors(direction, lateral).normalize();
      for (let row = 0; row < 2; row++) {
        const lift = (pivotY - row) * imageHeight;
        const index = (i * 2 + row) * 3;
        vertices[index] = width * .5 + (point.x + shiftX) * pixels + up.x * lift;
        vertices[index + 1] = height * .5 + (point.y + shiftY) * pixels + up.y * lift;
        vertices[index + 2] = point.z * pixels + up.z * lift;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function resize() {
    width = hero.clientWidth;
    height = hero.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
    if (!reduced.matches) draw();
  }

  function frame(now) {
    if (previous !== undefined) {
      const elapsed = Math.min((now - previous) / 1000, .05);
      time += elapsed;
      if (path) distance += elapsed * swimDefaults.speed;
    }
    previous = now;
    draw();
    request = requestAnimationFrame(frame);
  }

  function updateMotion() {
    cancelAnimationFrame(request);
    previous = undefined;
    canvas.hidden = reduced.matches;
    if (!reduced.matches) request = requestAnimationFrame(frame);
  }

  const observer = new ResizeObserver(resize);
  const dispose = () => {
    cancelAnimationFrame(request);
    observer.disconnect();
    reduced.removeEventListener('change', updateMotion);
    signal?.removeEventListener('abort', dispose);
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
    canvas.remove();
  };
  observer.observe(hero);
  reduced.addEventListener('change', updateMotion);
  signal?.addEventListener('abort', dispose, { once: true });
  resize();
  updateMotion();
  return dispose;
}

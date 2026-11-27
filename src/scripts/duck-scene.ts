/**
 * Homepage WebGL scene, drawn in the logo's style: flat cartoon colours with a
 * thick dark outline. The duck from the logo (yellow, orange beak, black
 * glasses, feather tuft) is the guide. It swims from one set piece to the next
 * as the visitor scrolls, one set piece per homepage section:
 *
 *   hero      the duck, alone, three-quarter view like the logo
 *   overpay   a cloud with a coin slot swallowing coins ("renting" AI)
 *   offers    three numbered steps up to a small AI headquarters (the offer ladder)
 *   services  six badges, one per service, orbiting the duck
 *   range     six tiles, one per kind of AI, fanned behind the duck
 *   proof     the local AI rig (the GPU tower from the case study)
 *   process   three numbered stepping stones
 *   faq       a big question mark
 *   book      the duck faces you, next to a calendar with a check mark
 *
 * Every set piece is built from primitives, so the scene works with no model
 * files. Tripo models dropped into /models/ replace the duck and the bigger set
 * pieces by name, and get the same cartoon shading and outline on load.
 * three.js loads from a pinned CDN build after first paint, off the critical path.
 */
import type { Tier } from './tier';
import { ICONS, type IconName } from '../lib/site/icons';
export type { Tier };

export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js/+esm';
/** three's own post-processing passes, from the same pinned CDN build. */
const FX_URL = (p: string) => `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/${p}/+esm`;
/** Where the opening's glint crosses the glasses, in the duck's own space (beak down +x). */
const GLINT = { x: 0.34, y: 0.78, z0: -0.28, z1: 0.26 };
const MODEL_BASE = (globalThis as { RDTS_MODEL_BASE?: string }).RDTS_MODEL_BASE ?? '/models/';
/** Model files the scene looks for. Each one is optional. */
export const MODEL_FILES = {
  duck: 'duck-guide.glb',
  cloud: 'set-overpay-cloud.glb',
  hq: 'set-offers-hq.glb',
  rig: 'set-proof-rig.glb',
  calendar: 'set-book-calendar.glb',
} as const;
export const DUCK_MODEL_URL = MODEL_BASE + MODEL_FILES.duck;
/**
 * Which way each model faces, in degrees about the vertical axis. glTF models
 * face +z; the duck's beak has to point down +x. The Tripo duck was made from a
 * three-quarter drawing, so its beak sits 45 degrees off +z. An optional
 * /models/manifest.json ({"duck-guide.glb": {"yaw": 45}}) overrides these
 * without a code change.
 */
const MODEL_YAW: Record<string, number> = { [MODEL_FILES.duck]: 45 };

/** Logo colours. */
const LOGO = { yellow: '#FDD02F', orange: '#F7931E', ink: '#141414', paper: '#FFF8E1', slate: '#2A2F38', night: '#0E1116' };
/** Service icons in the order of the services grid. */
const SERVICE_ICONS: IconName[] = ['compass', 'agent', 'code', 'web', 'gauge', 'chip'];
/** "Every kind of AI" icons in the order of the range grid. */
const RANGE_ICONS: IconName[] = ['chip', 'agent', 'search', 'mic', 'film', 'cube'];

/* eslint-disable @typescript-eslint/no-explicit-any */
let T: any;
async function loadThree() { T = await import(/* @vite-ignore */ THREE_URL); }

// ---------------------------------------------------------------------------
// Cartoon look: 3-step toon shading plus an inverted-hull outline.
// ---------------------------------------------------------------------------
let gradient: any;
/** Fog values shared by every custom shader (outlines, water), updated per frame. */
const fogU: { color: any; near: { value: number }; far: { value: number } } = { color: { value: null }, near: { value: 9 }, far: { value: 24 } };
const outlineCache = new Map<string, any>();

function toon(color: string, extra: Record<string, unknown> = {}) {
  return new T.MeshToonMaterial({ color: new T.Color(color), gradientMap: gradient, ...extra });
}

function outlineMat(push: number) {
  const k = push.toFixed(4);
  let m = outlineCache.get(k);
  if (!m) {
    m = new T.ShaderMaterial({
      side: T.BackSide, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 6,
      uniforms: { uColor: { value: new T.Color(LOGO.ink) }, uPush: { value: push }, uFogColor: fogU.color, uFogNear: fogU.near, uFogFar: fogU.far },
      vertexShader: 'uniform float uPush; varying float vD; void main(){ vec3 p = position + normal * uPush; vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; varying float vD; void main(){ gl_FragColor = vec4(mix(uColor, uFogColor, smoothstep(uFogNear, uFogFar, vD)), 1.0); }',
    });
    outlineCache.set(k, m);
  }
  return m;
}

/** Outline for smooth shapes (spheres, tori, models): push the hull out along normals. */
function ink(m: any, push = 0.035, geo?: any) {
  const o = new T.Mesh(geo ?? m.geometry, outlineMat(push));
  o.raycast = () => {};
  m.add(o);
  return m;
}
/** Outline for hard-edged shapes (boxes, cylinders): a slightly larger back-face copy. */
function inkScaled(m: any, grow = 0.06) {
  const o = new T.Mesh(m.geometry, outlineMat(0));
  o.scale.setScalar(1 + grow);
  o.raycast = () => {};
  m.add(o);
  return m;
}

function mesh(geo: any, mat: any, pos?: number[], scale?: number[] | number) {
  const m = new T.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (Array.isArray(scale)) m.scale.set(scale[0], scale[1], scale[2]);
  else if (scale !== undefined) m.scale.setScalar(scale);
  return m;
}

// ---------------------------------------------------------------------------
// Faces drawn onto canvas textures (badge icons, step numbers, calendar page).
// ---------------------------------------------------------------------------
function drawIcon(g: CanvasRenderingContext2D, svg: string) {
  for (const tag of svg.match(/<(circle|rect|path)[^>]*>/g) || []) {
    const a = (n: string) => Number((tag.match(new RegExp(`\\b${n}="([^"]+)"`)) || [])[1] || 0);
    g.beginPath();
    if (tag.startsWith('<circle')) { g.arc(a('cx'), a('cy'), a('r'), 0, Math.PI * 2); g.stroke(); }
    else if (tag.startsWith('<rect')) { g.roundRect(a('x'), a('y'), a('width'), a('height'), a('rx')); g.stroke(); }
    else { const d = (tag.match(/\bd="([^"]+)"/) || [])[1]; if (d) g.stroke(new Path2D(d)); }
  }
}

function faceTexture(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function iconFace(name: IconName, shape: 'disc' | 'tile') {
  return faceTexture((g, s) => {
    g.fillStyle = LOGO.ink;
    g.fillRect(0, 0, s, s);
    g.fillStyle = LOGO.yellow;
    g.beginPath();
    if (shape === 'disc') g.arc(s / 2, s / 2, s * 0.44, 0, Math.PI * 2);
    else g.roundRect(s * 0.07, s * 0.07, s * 0.86, s * 0.86, s * 0.16);
    g.fill();
    g.save();
    const k = (s * 0.52) / 24;
    g.translate(s / 2 - 12 * k, s / 2 - 12 * k);
    g.scale(k, k);
    g.strokeStyle = LOGO.ink;
    g.lineWidth = 2.1;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    drawIcon(g, ICONS[name]);
    g.restore();
  });
}

function numberFace(n: number) {
  return faceTexture((g, s) => {
    g.fillStyle = LOGO.yellow;
    g.fillRect(0, 0, s, s);
    g.fillStyle = LOGO.ink;
    g.font = `800 ${s * 0.5}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), s / 2, s / 2 + s * 0.03);
  });
}

// ---------------------------------------------------------------------------
// The duck, built to match the logo. Beak points down +x.
// ---------------------------------------------------------------------------
function buildDuck(tier: Tier) {
  const seg = tier === 'low' ? 28 : 56;
  const duck = new T.Group();
  const yellow = toon(LOGO.yellow);
  const orange = toon(LOGO.orange);
  const black = toon(LOGO.ink);
  const white = new T.MeshBasicMaterial({ color: 0xffffff });
  const sph = (r: number, n = seg) => new T.SphereGeometry(r, n, Math.max(12, (n / 2) | 0));

  // Body: a squat egg with the tail flicked up and back, like the logo.
  duck.add(ink(mesh(sph(1), yellow, [0, 0.55, 0], [1.25, 0.8, 0.95]), 0.03));
  const tail = ink(mesh(sph(0.42, seg / 2), yellow, [-1.08, 0.98, 0], [1, 0.62, 0.85]), 0.05);
  tail.rotation.z = 0.9;
  duck.add(tail);
  // Wings: the curved line on the logo's body.
  for (const z of [-0.8, 0.8]) {
    const wing = ink(mesh(sph(0.5, seg / 2), yellow, [-0.18, 0.7, z], [1.25, 0.5, 0.22]), 0.06);
    wing.rotation.z = 0.32;
    duck.add(wing);
  }
  // Head.
  const headC = new T.Vector3(0.62, 1.62, 0);
  const R = 0.62;
  duck.add(ink(mesh(sph(R), yellow, headC.toArray()), 0.03));
  // Feather tuft: three little flicks on top.
  [[-0.17, 0.45], [-0.04, 0.1], [0.09, -0.3]].forEach(([dx, tilt], i) => {
    const f = ink(mesh(sph(0.13, 20), yellow, [headC.x + dx, headC.y + R + 0.03 - i * 0.02, 0], [0.55, 1.35, 0.5]), 0.05);
    f.rotation.z = tilt;
    duck.add(f);
  });
  // Beak: a flat orange bill, upper and lower.
  duck.add(ink(mesh(sph(0.3, seg / 2), orange, [1.2, 1.5, 0], [1.35, 0.36, 1.0]), 0.06));
  const billLow = ink(mesh(sph(0.27, seg / 2), orange, [1.13, 1.4, 0], [1.15, 0.26, 0.85]), 0.07);
  duck.add(billLow);
  // Eyes and thick black glasses, sat on the head's surface.
  const ringGeo = new T.TorusGeometry(0.17, 0.042, 12, 40);
  for (const zs of [-1, 1]) {
    const dir = new T.Vector3(0.73, 0.4, 0.56 * zs).normalize();
    const onHead = (out: number) => dir.clone().multiplyScalar(R + out).add(headC);
    duck.add(mesh(sph(0.085, 20), black, onHead(-0.02).toArray(), [0.75, 1.15, 0.75]));
    duck.add(mesh(sph(0.026, 10), white, onHead(0.05).add(new T.Vector3(0, 0.035, 0)).toArray()));
    const ring = mesh(ringGeo, black, onHead(0.07).toArray());
    ring.lookAt(onHead(1).applyMatrix4(duck.matrixWorld));
    duck.add(ring);
    const arm = mesh(new T.CylinderGeometry(0.025, 0.025, 0.55, 8), black, [headC.x + 0.05, headC.y + 0.26, zs * 0.58]);
    arm.rotation.z = Math.PI / 2 - 0.12;
    arm.rotation.y = zs * 0.25;
    duck.add(arm);
  }
  const bridge = mesh(new T.TorusGeometry(0.1, 0.035, 8, 16, Math.PI), black, [headC.x + 0.56, headC.y + 0.3, 0]);
  bridge.rotation.y = Math.PI / 2;
  duck.add(bridge);

  duck.scale.setScalar(0.62);
  return { duck, bill: billLow };
}

// ---------------------------------------------------------------------------
// Set pieces. Each is a Group whose built-in shapes a Tripo model can replace.
// ---------------------------------------------------------------------------
function buildCloud() {
  const g = new T.Group();
  const white = toon(LOGO.paper);
  [[0, 0, 0, 0.62], [-0.55, -0.12, 0.05, 0.45], [0.55, -0.1, 0, 0.48], [-0.25, 0.32, -0.05, 0.42], [0.3, 0.28, 0.05, 0.4]]
    .forEach(([x, y, z, r]) => g.add(ink(mesh(new T.SphereGeometry(r, 28, 18), white, [x, y, z]), 0.03)));
  // Coin slot on top, and a price tag hanging off the side.
  g.add(inkScaled(mesh(new T.BoxGeometry(0.5, 0.08, 0.14), toon(LOGO.ink), [0, 0.68, 0])));
  const tag = inkScaled(mesh(new T.BoxGeometry(0.32, 0.22, 0.03), toon(LOGO.orange), [0.95, -0.4, 0.2]));
  tag.rotation.z = -0.35;
  g.add(tag);
  return g;
}

function buildHQ() {
  const g = new T.Group();
  g.add(inkScaled(mesh(new T.BoxGeometry(0.9, 0.7, 0.7), toon(LOGO.slate), [0, 0.35, 0])));
  const lit = toon(LOGO.yellow, { emissive: new T.Color(LOGO.yellow), emissiveIntensity: 0.6 });
  for (let i = 0; i < 3; i++) g.add(mesh(new T.BoxGeometry(0.7, 0.06, 0.02), lit, [0, 0.18 + i * 0.18, 0.36]));
  g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.5, 8), toon(LOGO.ink), [0, 0.95, 0]));
  const dish = ink(mesh(new T.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(LOGO.yellow, { side: T.DoubleSide }), [0, 1.2, 0]), 0.02);
  dish.rotation.x = Math.PI * 0.8;
  g.add(dish);
  g.userData.spin = dish;
  return g;
}

function buildRig() {
  const g = new T.Group();
  g.add(inkScaled(mesh(new T.BoxGeometry(0.75, 1.4, 1.1), toon('#22262E'), [0, 0.7, 0]), 0.04));
  const glow = toon(LOGO.yellow, { emissive: new T.Color(LOGO.yellow), emissiveIntensity: 0.9 });
  const fans: any[] = [];
  for (let i = 0; i < 3; i++) {
    const fan = mesh(new T.TorusGeometry(0.17, 0.035, 10, 32), glow, [0.38, 0.32 + i * 0.4, 0.2]);
    fan.rotation.y = Math.PI / 2;
    const blade = mesh(new T.BoxGeometry(0.28, 0.05, 0.01), toon(LOGO.ink));
    fan.add(blade);
    fans.push(fan);
    g.add(fan);
  }
  // The GPU glowing through the side window, and a duck sticker.
  g.add(mesh(new T.BoxGeometry(0.02, 0.18, 0.75), glow, [0.38, 0.95, -0.2]));
  const sticker = ink(mesh(new T.CircleGeometry(0.1, 24), toon(LOGO.yellow), [0.385, 1.25, -0.38]), 0);
  sticker.rotation.y = Math.PI / 2;
  g.add(sticker);
  g.userData.fans = fans;
  g.userData.glow = glow;
  return g;
}

function buildCalendar() {
  const g = new T.Group();
  g.add(inkScaled(mesh(new T.BoxGeometry(1.1, 0.12, 0.5), toon(LOGO.ink), [0, 0.06, 0])));
  const page = faceTexture((c, s) => {
    c.fillStyle = LOGO.paper; c.fillRect(0, 0, s, s);
    c.fillStyle = LOGO.orange; c.fillRect(0, 0, s, s * 0.22);
    c.strokeStyle = 'rgba(20,20,20,.25)'; c.lineWidth = 3;
    for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) c.strokeRect(s * 0.08 + q * s * 0.168, s * 0.3 + r * s * 0.165, s * 0.15, s * 0.14);
    c.strokeStyle = LOGO.ink; c.lineWidth = s * 0.05; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(s * 0.3, s * 0.62); c.lineTo(s * 0.45, s * 0.77); c.lineTo(s * 0.74, s * 0.42); c.stroke();
  });
  const p = toon(LOGO.paper);
  const board = inkScaled(mesh(new T.BoxGeometry(1.0, 1.0, 0.06), [p, p, p, p, toon('#ffffff', { map: page }), p], [0, 0.62, 0]), 0.04);
  board.rotation.x = -0.18;
  g.add(board);
  for (const x of [-0.3, 0.3]) g.add(ink(mesh(new T.TorusGeometry(0.07, 0.022, 8, 20), toon('#9AA0A6'), [x, 1.13, -0.08]), 0.012));
  return g;
}

function badge(name: IconName, r = 0.3) {
  const face = toon('#ffffff', { map: iconFace(name, 'disc') });
  const m = inkScaled(mesh(new T.CylinderGeometry(r, r, 0.1, 40), [toon(LOGO.yellow), face, face]), 0.05);
  m.rotation.x = Math.PI / 2;    // icon face points down the holder's +z, which lookAt aims
  const holder = new T.Group();
  holder.add(m);
  return holder;
}

function tile(name: IconName, s = 0.5) {
  const face = toon('#ffffff', { map: iconFace(name, 'tile') });
  const side = toon(LOGO.ink);
  return inkScaled(mesh(new T.BoxGeometry(s, s, 0.08), [side, side, side, side, face, face]), 0.04);
}

function questionMark() {
  const g = new T.Group();
  const y = toon(LOGO.yellow);
  const hook = ink(mesh(new T.TorusGeometry(0.36, 0.12, 16, 40, Math.PI * 1.35), y, [0, 0.55, 0]), 0.03);
  hook.rotation.z = -Math.PI * 0.42;
  g.add(hook);
  g.add(ink(mesh(new T.CapsuleGeometry(0.12, 0.22, 6, 16), y, [0.02, 0.0, 0]), 0.03));
  g.add(ink(mesh(new T.SphereGeometry(0.14, 20, 14), y, [0.02, -0.45, 0]), 0.03));
  return g;
}

// ---------------------------------------------------------------------------
// Optional Tripo models.
// ---------------------------------------------------------------------------
let gltfLoader: any = null;
let manifest: Promise<Record<string, { yaw?: number }>> | null = null;
async function tryModel(file: string, size: number, glow = 0): Promise<any | null> {
  const url = MODEL_BASE + file;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || !/model|octet|gltf/.test(head.headers.get('content-type') || '')) return null;
    manifest ??= fetch(MODEL_BASE + 'manifest.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    const yaw = ((await manifest)[file]?.yaw ?? MODEL_YAW[file] ?? 0) * Math.PI / 180;
    if (!gltfLoader) { const { GLTFLoader } = await import(/* @vite-ignore */ GLTF_URL); gltfLoader = new GLTFLoader(); }
    const model = (await gltfLoader.loadAsync(url)).scene;
    model.rotation.y = yaw;
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model);
    const dims = box.getSize(new T.Vector3());
    const fit = size / Math.max(dims.x, dims.y, dims.z);
    model.scale.setScalar(fit);
    const c = box.getCenter(new T.Vector3()).multiplyScalar(fit);
    model.position.set(-c.x, -box.min.y * fit, -c.z);
    const holder = new T.Group();
    holder.add(model);
    holder.updateMatrixWorld(true);
    // Same cartoon look as the built-in shapes: toon shading keeps Tripo's colours, plus the outline.
    const ws = new T.Vector3();
    const meshes: any[] = [];
    model.traverse((o: any) => { if (o.isMesh) meshes.push(o); });
    // Parts that share one vertex buffer (a model split by colour) get one outline hull
    // between them: a hull per part shows through the holes where the other parts sit.
    const byPos = new Map<any, any[]>();
    for (const o of meshes) { const k = o.geometry.attributes.position; byPos.set(k, [...(byPos.get(k) ?? []), o]); }
    const hullFor = new Map<any, any>();
    for (const [pos, group] of byPos) {
      if (group.length < 2 || group.some((o: any) => !o.geometry.index)) continue;
      const idx: number[] = [];
      for (const o of group) idx.push(...(o.geometry.index.array as ArrayLike<number>));
      const merged = new T.BufferGeometry();
      merged.setAttribute('position', pos);
      merged.setAttribute('normal', group[0].geometry.attributes.normal);
      merged.setIndex(idx);
      hullFor.set(group[0], merged);
      for (const o of group.slice(1)) hullFor.set(o, null);
    }
    for (const o of meshes) {
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      o.material = new T.MeshToonMaterial({
        color: src?.color ?? new T.Color('#ffffff'), map: src?.map ?? null, gradientMap: gradient,
        emissive: glow && src?.map ? new T.Color(1, 0.86, 0.35) : (src?.emissive ?? new T.Color(0)),
        emissiveMap: glow && src?.map ? src.map : (src?.emissiveMap ?? null),
        emissiveIntensity: glow || (src?.emissiveIntensity ?? 1),
      });
      if (glow) o.userData.glowMat = o.material;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.getWorldScale(ws);
      const hg = hullFor.has(o) ? hullFor.get(o) : o.geometry;
      if (hg) inkRim(o.material);
    }
    return holder;
  } catch { return null; }
}

/**
 * Ink outline for generated models, drawn in the material: the surface goes to the
 * logo's black where it turns away from the camera. Generated models are made of
 * overlapping shells (wing, glasses, eyes), which an inverted-hull outline pokes through.
 */
function inkRim(mat: any, width = 0.32) {
  mat.onBeforeCompile = (sh: any) => {
    sh.uniforms.uInkC = { value: new T.Color(LOGO.ink) };
    sh.uniforms.uInkW = { value: width };
    sh.fragmentShader = 'uniform vec3 uInkC; uniform float uInkW;\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
      float rimInk = 1.0 - smoothstep(uInkW - 0.06, uInkW + 0.02, ndv);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uInkC, rimInk);`);
  };
  mat.customProgramCacheKey = () => 'inkRim' + width;
  mat.needsUpdate = true;
}

/**
 * Generated meshes split their normals along texture seams, which cracks an
 * inverted-hull outline into visible lines. The hull gets its own normals,
 * averaged over every vertex that shares a position.
 */
function smoothHull(geo: any) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const key = (i: number) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const sum = new Map<string, number[]>();
  for (let i = 0; i < p.count; i++) {
    const k = key(i), v = sum.get(k) ?? [0, 0, 0];
    v[0] += n.getX(i); v[1] += n.getY(i); v[2] += n.getZ(i);
    sum.set(k, v);
  }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = sum.get(key(i))!, l = Math.hypot(v[0], v[1], v[2]) || 1;
    out[i * 3] = v[0] / l; out[i * 3 + 1] = v[1] / l; out[i * 3 + 2] = v[2] / l;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', p);
  g.setAttribute('normal', new T.BufferAttribute(out, 3));
  if (geo.index) g.setIndex(geo.index);
  return g;
}

/** Replace a set piece's built-in shapes with a model when the file exists. */
function upgrade(group: any, file: string, size: number, then?: (m: any) => void, glow = 0) {
  tryModel(file, size, glow).then(m => {
    if (!m) return;
    group.clear();
    group.userData = {};
    group.add(m);
    then?.(m);
  });
}

// ---------------------------------------------------------------------------
// Water: cartoon water that reflects the section's sky, with cel-banded
// highlights, ripple rings around the set piece in focus, the opening's ring of
// light, and a V-shaped wake behind the duck.
// ---------------------------------------------------------------------------
function waterMaterial() {
  return new T.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPulse: { value: 0 }, uFocus: { value: new T.Vector2() },
      uDeep: { value: new T.Color('#0b0f18') }, uSky: { value: new T.Color('#3b2a1e') }, uGlint: { value: new T.Color(LOGO.yellow) },
      uSunDir: { value: new T.Vector3(0.4, 0.6, 0.6) },
      uDuck: { value: new T.Vector2() }, uHead: { value: new T.Vector2(1, 0) }, uSpeed: { value: 0 },
      uRing: { value: -1 }, uRingC: { value: new T.Vector2() },
      uFogColor: fogU.color, uFogNear: fogU.near, uFogFar: fogU.far,
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec2 uFocus; uniform float uRing; uniform vec2 uRingC;
      varying vec3 vW; varying float vH; varying float vD;
      float waves(vec2 p) {
        float d = length(p - uFocus);
        float h = sin(d * 2.2 - uTime * 1.5) * 0.04 * exp(-d * 0.22);
        h += sin(p.x * 0.6 + uTime * 0.55) * 0.035 + cos(p.y * 0.8 - uTime * 0.42) * 0.03 + sin((p.x + p.y) * 1.7 + uTime) * 0.012;
        if (uRing >= 0.0) { float r = length(p - uRingC); h += exp(-pow((r - uRing * 7.0) * 3.0, 2.0)) * 0.12 * (1.0 - uRing); }
        return h;
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float h = waves(w.xz);
        w.y += h; vH = h; vW = w.xyz;
        vec4 mv = viewMatrix * w; vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPulse; uniform vec2 uFocus; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uGlint;
      uniform vec3 uSunDir; uniform vec2 uDuck; uniform vec2 uHead; uniform float uSpeed; uniform float uRing; uniform vec2 uRingC;
      uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
      varying vec3 vW; varying float vH; varying float vD;
      void main() {
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        if (n.y < 0.0) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), 3.0);
        // Cel-banded sky reflection and sun glints.
        float band = floor(fres * 3.0 + 0.5) / 3.0;
        vec3 col = mix(uDeep, uSky, 0.15 + band * 0.75);
        vec3 hv = normalize(normalize(uSunDir) + v);
        float spec = pow(max(dot(n, hv), 0.0), 120.0);
        col += uSky * step(0.55, spec) * 0.9 + uSky * smoothstep(0.03, 0.06, vH) * 0.12;
        // Ripple rings around the set piece in focus.
        float d = length(vW.xz - uFocus);
        float ring = smoothstep(0.06, 0.0, abs(fract(d * 0.42 - uTime * 0.22) - 0.5) - 0.45) * exp(-d * 0.35);
        col += uGlint * ring * (0.18 + uPulse * 0.4);
        // The opening's ring of light.
        if (uRing >= 0.0) { float r = length(vW.xz - uRingC); col += uGlint * exp(-pow((r - uRing * 7.0) * 2.2, 2.0)) * (1.0 - uRing) * 2.2; }
        // Wake: a foam collar round the duck and two lines fanning out behind it.
        vec2 q = vW.xz - uDuck; vec2 side = vec2(-uHead.y, uHead.x);
        float ahead = dot(q, uHead), lat = abs(dot(q, side));
        float collar = smoothstep(0.08, 0.0, abs(length(q) - 0.62 - sin(uTime * 3.0) * 0.03));
        float behind = max(-ahead - 0.3, 0.0);
        float vee = smoothstep(0.07, 0.0, abs(lat - 0.5 - behind * 0.36)) * exp(-behind * 0.45) * step(0.0, -ahead - 0.3);
        float foam = (collar * (0.35 + uSpeed * 0.5) + vee * uSpeed * 1.1) * (0.85 + 0.15 * sin(vW.x * 20.0 + uTime * 6.0));
        col = mix(col, vec3(1.0, 0.97, 0.88), clamp(foam, 0.0, 1.0) * 0.75);
        gl_FragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vD)), 1.0);
      }`,
  });
}

/** Sky dome: a three-stop gradient with a soft sun and stars, all driven by the section's light. */
function skyMaterial() {
  return new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {
      uTop: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uSun: { value: new T.Color() },
      uSunDir: { value: new T.Vector3(0.4, 0.3, -0.8) }, uStars: { value: 0 }, uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uStars; uniform float uTime;
      varying vec3 vDir;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -1.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(clamp(y, 0.0, 1.0), 0.55));
        col = mix(col, uHorizon * 0.6, clamp(-y * 4.0, 0.0, 1.0));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSun * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.8);
        vec3 c = floor(d * 220.0);
        float st = step(0.9965, hash(c)) * clamp(y * 3.0, 0.0, 1.0) * uStars;
        col += vec3(1.0, 0.95, 0.8) * st * (0.6 + 0.4 * sin(uTime * 2.0 + hash(c + 3.0) * 40.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Film look: vignette and fine moving grain, applied after tone mapping. */
const GRAIN_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 }, uVignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.25, 0.85, length(q * vec2(1.15, 1.0)));
      float g = rnd(vUv * vec2(1931.0, 1173.0) + fract(uTime * 7.31)) - 0.5;
      c.rgb += g * uGrain * (1.0 - c.rgb * 0.6);
      gl_FragColor = c;
    }`,
};

// ---------------------------------------------------------------------------
// Stations: where each homepage section's set piece sits, how the camera frames
// it, and the light it is filmed in. Camera offsets are from the station; the
// camera looks down -z, so +x is screen-right, away from the text column.
// ---------------------------------------------------------------------------
type Light = {
  key: string; keyI: number; keyDir: number[]; rim: string; rimI: number; sky: string; ground: string; hemiI: number;
  top: string; horizon: string; sun: string; fog: string; fogNear: number; fogFar: number; deep: string; stars: number;
  exposure: number; bloom: number; dust: string;
};
type Station = { id: string; at: number[]; cam: number[]; look: number[]; turn: number; fr: number[]; frm: number[]; light: Light };
const L = (l: Light) => l;
const NIGHT = L({ key: '#86a4ff', keyI: 1.2, keyDir: [-2, 5, 3], rim: '#FDD02F', rimI: 2.4, sky: '#1c2a55', ground: '#05070c', hemiI: 0.9,
  top: '#03060f', horizon: '#14254d', sun: '#2b4a9a', fog: '#0a1226', fogNear: 9, fogFar: 26, deep: '#03060d', stars: 1, exposure: 1.05, bloom: 0.95, dust: '#FDD02F' });
export const STATIONS: Station[] = [
  { id: 's-hero', at: [0, 0, 0], cam: [1.2, 1.2, 4.7], look: [0, 0.68, 0], turn: 0.6, fr: [0.66, 0.4], frm: [0.5, 0.27],
    light: L({ key: '#ffd7a1', keyI: 2.7, keyDir: [3, 5, 5], rim: '#FDD02F', rimI: 3.2, sky: '#4a3a5a', ground: '#0b0d12', hemiI: 1.1,
      top: '#0a0c1a', horizon: '#4a2c22', sun: '#ff9a4a', fog: '#1d1418', fogNear: 9, fogFar: 26, deep: '#07080d', stars: 0.35, exposure: 1.0, bloom: 0.6, dust: '#ffcf7a' }) },
  { id: 's-overpay', at: [5, 0, -7], cam: [2.2, 1.8, 5.6], look: [1.0, 1.0, -0.7], turn: 0.45, fr: [0.69, 0.36], frm: [0.5, 0.3],
    light: L({ key: '#a9bcdc', keyI: 1.5, keyDir: [-1, 6, 4], rim: '#F7931E', rimI: 2.2, sky: '#3a4a62', ground: '#0b0e14', hemiI: 1.0,
      top: '#0c1119', horizon: '#2c3748', sun: '#56657e', fog: '#1a222e', fogNear: 7, fogFar: 22, deep: '#070a10', stars: 0, exposure: 0.95, bloom: 0.8, dust: '#9fb1c9' }) },
  { id: 's-offers', at: [10, 0, -14], cam: [2.9, 2.1, 5.9], look: [1.7, 1.0, -1.1], turn: 0.5, fr: [0.69, 0.36], frm: [0.5, 0.3],
    light: L({ key: '#ffb37a', keyI: 2.8, keyDir: [5, 2.2, -2], rim: '#ff8a3d', rimI: 2.6, sky: '#8a5a6a', ground: '#140d10', hemiI: 1.15,
      top: '#1b1f3f', horizon: '#e27a4c', sun: '#ffb26b', fog: '#47283a', fogNear: 10, fogFar: 30, deep: '#120c16', stars: 0.15, exposure: 1.05, bloom: 0.7, dust: '#ffc58a' }) },
  { id: 's-services', at: [5, 0, -21], cam: [0.5, 2.6, 6.4], look: [0, 1.05, 0], turn: 0.3, fr: [0.7, 0.34], frm: [0.5, 0.3], light: NIGHT },
  { id: 's-range', at: [-1, 0, -28], cam: [1.0, 2.3, 6.2], look: [0.6, 1.15, -0.8], turn: 0.3, fr: [0.7, 0.34], frm: [0.5, 0.3],
    light: { ...NIGHT, horizon: '#1f1d52', top: '#05041a', fog: '#0e0c2a', sun: '#4a3aa8' } },
  { id: 's-proof', at: [-6, 0, -35], cam: [2.0, 1.5, 5.2], look: [1.0, 0.95, -0.5], turn: 0.55, fr: [0.69, 0.36], frm: [0.5, 0.3],
    light: L({ key: '#56637d', keyI: 0.7, keyDir: [-3, 6, 2], rim: '#FDD02F', rimI: 2.8, sky: '#1a2030', ground: '#030405', hemiI: 0.55,
      top: '#020304', horizon: '#0b0f17', sun: '#20283a', fog: '#06080c', fogNear: 6, fogFar: 18, deep: '#020305', stars: 0, exposure: 1.1, bloom: 1.2, dust: '#FDD02F' }) },
  { id: 's-process', at: [-1, 0, -42], cam: [2.5, 2.7, 5.4], look: [1.5, 0.45, -0.8], turn: 0.4, fr: [0.69, 0.36], frm: [0.5, 0.3],
    light: L({ key: '#fff6e6', keyI: 3.0, keyDir: [3, 8, 4], rim: '#cfe6ff', rimI: 1.4, sky: '#b9d6ff', ground: '#33404f', hemiI: 1.6,
      top: '#2f6fc4', horizon: '#9cc8ee', sun: '#ffffff', fog: '#7fa9cf', fogNear: 12, fogFar: 34, deep: '#123a5e', stars: 0, exposure: 0.95, bloom: 0.35, dust: '#ffffff' }) },
  { id: 's-faq', at: [4, 0, -49], cam: [1.7, 1.5, 5.2], look: [0.9, 1.0, -0.5], turn: 0.45, fr: [0.69, 0.36], frm: [0.5, 0.3],
    light: L({ key: '#ece4f2', keyI: 1.9, keyDir: [1, 7, 5], rim: '#ffd9a8', rimI: 1.4, sky: '#8c8fb0', ground: '#1a1b26', hemiI: 1.3,
      top: '#262a44', horizon: '#666b8c', sun: '#c9c2e0', fog: '#3e425c', fogNear: 9, fogFar: 28, deep: '#151826', stars: 0.1, exposure: 1.0, bloom: 0.45, dust: '#efe6ff' }) },
  { id: 's-book', at: [0, 0, -56], cam: [0.2, 1.25, 4.7], look: [0.6, 0.65, -0.25], turn: -0.25, fr: [0.18, 0.46], frm: [0.5, 0.26],
    light: L({ key: '#ffb24a', keyI: 3.0, keyDir: [-4, 2.4, -3], rim: '#ff7b2e', rimI: 3.0, sky: '#8a5a52', ground: '#140c0a', hemiI: 1.1,
      top: '#24193d', horizon: '#ff9448', sun: '#ffb45a', fog: '#5a3434', fogNear: 9, fogFar: 30, deep: '#160c0e', stars: 0.05, exposure: 1.05, bloom: 0.75, dust: '#ffd08a' }) },
];

function smooth(t: number) { return t * t * (3 - 2 * t); }
function clamp01(t: number) { return Math.min(1, Math.max(0, t)); }
function easeOutBack(t: number, k = 1.70158) { const u = t - 1; return 1 + (k + 1) * u * u * u + k * u * u; }
function angLerp(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** The opening shot, in seconds. Scrolling or reduced motion skips it. */
const OPEN_SECONDS = 3.2;

export async function startDuckScene(canvas: HTMLCanvasElement, opts: { tier: Tier; reducedMotion: boolean }) {
  await loadThree();
  const { tier, reducedMotion } = opts;
  const post = tier !== 'low';
  const fx = post ? await Promise.all([
    import(/* @vite-ignore */ FX_URL('postprocessing/EffectComposer.js')),
    import(/* @vite-ignore */ FX_URL('postprocessing/RenderPass.js')),
    import(/* @vite-ignore */ FX_URL('postprocessing/UnrealBloomPass.js')),
    import(/* @vite-ignore */ FX_URL('postprocessing/ShaderPass.js')),
    import(/* @vite-ignore */ FX_URL('postprocessing/OutputPass.js')),
  ]).catch(() => null) : null;

  gradient = new T.DataTexture(new Uint8Array([60, 150, 255]), 3, 1, T.RedFormat);
  gradient.minFilter = gradient.magFilter = T.NearestFilter;
  gradient.needsUpdate = true;
  fogU.color.value = new T.Color(LOGO.night);

  const renderer = new T.WebGLRenderer({ canvas, antialias: tier !== 'low' && !fx, alpha: false, powerPreference: 'high-performance' });
  const maxDpr = tier === 'high' ? 1.75 : tier === 'mid' ? 1.4 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color(LOGO.night), 9, 24);
  const camera = new T.PerspectiveCamera(42, 1, 0.1, 120);
  const hemi = new T.HemisphereLight(0xfff4d6, 0x1a1d24, 1.2);
  scene.add(hemi);
  const key = new T.DirectionalLight(0xffffff, 2.4);
  const rim = new T.DirectionalLight(0xFDD02F, 2.0);
  scene.add(key, key.target, rim, rim.target);
  const sky = new T.Mesh(new T.SphereGeometry(100, 32, 16), skyMaterial());
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // --- post-processing ----------------------------------------------------
  let composer: any = null, bloom: any = null, grain: any = null;
  if (fx) {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }, { OutputPass }] = fx;
    composer = new EffectComposer(renderer, new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: tier === 'high' ? 4 : 2 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new T.Vector2(256, 256), 0.6, 0.55, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grain = new ShaderPass(GRAIN_SHADER);
    composer.addPass(grain);
  }

  // --- the duck guide -------------------------------------------------------
  const duckRig = new T.Group();           // swims the route, turns to look
  const duckPose = new T.Group();          // squash, stretch, nod
  const built = buildDuck(tier);
  let duckBody = built.duck;
  let bill: any = built.bill;
  duckPose.add(duckBody);
  duckRig.add(duckPose);
  scene.add(duckRig);
  let duckReady = false;
  const duckLoad = tryModel(MODEL_FILES.duck, 1.3).then(m => {
    if (m) {
      m.position.y -= 0.14;
      duckPose.remove(duckBody);
      duckBody = new T.Group();
      duckBody.add(m);
      duckPose.add(duckBody);
      bill = null;
    }
    duckReady = true;
  });

  // Glint that sweeps across the glasses at the end of the opening.
  const glintTex = faceTexture((g, s) => {
    const c = s / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.18, 'rgba(255,245,210,.55)'); grd.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.fillRect(c - s * 0.48, c - 1.5, s * 0.96, 3); g.fillRect(c - 1.5, c - s * 0.3, 3, s * 0.6);
  }, 128);
  const glint = new T.Sprite(new T.SpriteMaterial({ map: glintTex, blending: T.AdditiveBlending, depthTest: false, transparent: true, opacity: 0, toneMapped: false }));
  glint.scale.setScalar(0.45);
  duckPose.add(glint);

  const stationGroup = (i: number) => { const g = new T.Group(); g.position.set(...STATIONS[i].at); scene.add(g); return g; };
  const anim: Array<(t: number) => void> = [];
  const pieces: Array<{ g: any; i: number; v: number; x: number; focus: any }> = [];
  /** A set piece that pops in with overshoot when its section arrives and settles away after. */
  const piece = (i: number, focus: number[]) => {
    const g = new T.Group();
    g.scale.setScalar(0.0001);
    stationGroup(i).add(g);
    pieces.push({ g, i, v: 0, x: 0, focus: new T.Vector3(...focus).add(new T.Vector3(...STATIONS[i].at)) });
    return g;
  };
  const holder = (st: any, item: any, pos: number[], scale = 1, rotY = 0) => {
    const h = new T.Group();
    h.position.set(pos[0], pos[1], pos[2]);
    h.scale.setScalar(scale);
    h.rotation.y = rotY;
    h.add(item);
    st.add(h);
    return h;
  };
  const glowLights: Array<{ light: any; i: number; base: number }> = [];

  // overpay: a cloud piggy bank swallowing coins, lit by their orange glow.
  {
    const st = piece(1, [1.7, 1.6, -1.3]);
    const cloud = buildCloud();
    const ch = holder(st, cloud, [1.7, 1.55, -1.3]);
    upgrade(cloud, MODEL_FILES.cloud, 1.8, m => { m.position.y -= 0.55; m.rotation.y = -0.35; });
    const coinMat = toon(LOGO.orange, { emissive: new T.Color(LOGO.orange), emissiveIntensity: 0.9 });
    const coins: any[] = [];
    for (let i = 0; i < 7; i++) {
      const c = inkScaled(mesh(new T.CylinderGeometry(0.12, 0.12, 0.035, 24), coinMat), 0.12);
      coins.push(c);
      st.add(c);
    }
    const coinLight = new T.PointLight(LOGO.orange, 0, 5, 1.6);
    coinLight.position.set(1.4, 1.2, -0.6);
    st.add(coinLight);
    glowLights.push({ light: coinLight, i: 1, base: 6 });
    anim.push(t => {
      coins.forEach((c, i) => {
        const k = (t * 0.22 + i / coins.length) % 1;
        c.position.set(0.6 + k * 1.1 + Math.sin(k * 6 + i) * 0.08, 0.45 + k * 1.95 - k * k * 0.3, -0.25 - k * 1.05);
        c.rotation.set(Math.PI / 2, 0, t * 2 + i);
        c.scale.setScalar(k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 8));
      });
      ch.position.y = 1.55 + Math.sin(t * 0.8) * 0.06;
      ch.rotation.z = Math.sin(t * 0.6) * 0.03;
    });
  }

  // offers: three numbered steps rising to a small AI headquarters.
  {
    const st = piece(2, [2.2, 1.0, -1.2]);
    const stepMat = toon(LOGO.slate);
    [[1.0, 0.3, -0.4, 0.42], [2.0, 0.75, -1.1, 0.5], [3.1, 1.3, -1.9, 0.62]].forEach(([x, h, z, r], i) => {
      const top = toon('#ffffff', { map: numberFace(i + 1) });
      st.add(inkScaled(mesh(new T.CylinderGeometry(r, r, h, 40), [stepMat, top, stepMat], [x, h / 2, z]), 0.04));
    });
    const hq = buildHQ();
    holder(st, hq, [3.1, 1.3, -1.9], 0.9, -0.35);
    upgrade(hq, MODEL_FILES.hq, 1.35, undefined, 1.4);
    const hqLight = new T.PointLight(LOGO.yellow, 0, 4, 1.8);
    hqLight.position.set(2.9, 2.0, -1.2);
    st.add(hqLight);
    glowLights.push({ light: hqLight, i: 2, base: 3 });
    anim.push(t => { const d = hq.userData.spin; if (d) d.rotation.z = t * 0.8; });
  }

  // Glowing wires from the duck to each item, like an agent network.
  const wireMat = new T.LineBasicMaterial({ color: new T.Color(LOGO.yellow).multiplyScalar(2.2), transparent: true, opacity: 0.55, toneMapped: false });
  function wired(st: any, items: any[]) {
    const lines = items.map(() => {
      const line = new T.Line(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)), wireMat);
      line.frustumCulled = false;
      st.add(line);
      return line;
    });
    return () => items.forEach((it, i) => {
      const a = lines[i].geometry.attributes.position;
      (a.array as Float32Array).set([0, 0.7, 0, it.position.x, it.position.y, it.position.z]);
      a.needsUpdate = true;
    });
  }

  // services: six badges orbiting the duck.
  {
    const st = piece(3, [0, 1.1, 0]);
    const badges = SERVICE_ICONS.map(n => { const b = badge(n); st.add(b); return b; });
    const sync = wired(st, badges);
    anim.push(t => {
      badges.forEach((b, i) => {
        const a = (i / badges.length) * Math.PI * 2 + t * 0.18;
        b.position.set(Math.cos(a) * 1.75, 1.15 + Math.sin(a * 2 + t * 0.7) * 0.16, Math.sin(a) * 1.75);
        b.lookAt(camera.position);
      });
      sync();
    });
  }

  // range: six tiles fanned behind the duck.
  {
    const st = piece(4, [0.6, 1.2, -1.2]);
    const tiles = RANGE_ICONS.map((n, i) => {
      const tl = tile(n);
      const a = Math.PI * (0.12 + (i / (RANGE_ICONS.length - 1)) * 0.76);
      tl.userData.base = [Math.cos(a) * 1.7 + 0.6, 1.05 + (i % 2) * 0.5, -Math.sin(a) * 1.2 - 0.4];
      st.add(tl);
      return tl;
    });
    const sync = wired(st, tiles);
    anim.push(t => {
      tiles.forEach((tl, i) => {
        const [x, y, z] = tl.userData.base;
        tl.position.set(x, y + Math.sin(t * 1.1 + i) * 0.07, z);
        tl.rotation.y = Math.sin(t * 0.5 + i) * 0.25;
      });
      sync();
    });
  }

  // proof: the local AI rig in a dark lab, lit by its own GPU.
  {
    const st = piece(5, [1.6, 0.9, -0.9]);
    const rig = buildRig();
    holder(st, rig, [1.6, 0, -0.9], 1.15, -0.5);
    upgrade(rig, MODEL_FILES.rig, 1.75, m => { m.rotation.y = 0.35; }, 1.6);
    const gpu = new T.PointLight(LOGO.yellow, 0, 6, 1.4);
    gpu.position.set(1.0, 1.0, -0.4);
    st.add(gpu);
    glowLights.push({ light: gpu, i: 5, base: 7 });
    anim.push(t => {
      (rig.userData.fans || []).forEach((f: any, i: number) => { f.rotation.x = t * (4 + i); });
      if (rig.userData.glow) rig.userData.glow.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.25;
      gpu.userData.flicker = 0.85 + Math.sin(t * 3) * 0.1 + Math.sin(t * 17) * 0.03;
    });
  }

  // process: three numbered stepping stones joined by a dotted path.
  {
    const st = piece(6, [1.9, 0.2, -0.9]);
    const stoneMat = toon(LOGO.slate);
    const pts = [[0.9, -0.2], [1.9, -0.9], [2.9, -1.7]];
    pts.forEach(([x, z], i) => {
      const top = toon('#ffffff', { map: numberFace(i + 1) });
      st.add(inkScaled(mesh(new T.CylinderGeometry(0.4, 0.45, 0.18, 36), [stoneMat, top, stoneMat], [x, 0.09, z]), 0.04));
    });
    const dotMat = toon(LOGO.yellow);
    for (let i = 0; i < 2; i++) for (let k = 1; k < 4; k++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
      st.add(mesh(new T.SphereGeometry(0.04, 10, 8), dotMat, [x0 + ((x1 - x0) * k) / 4, 0.14, z0 + ((z1 - z0) * k) / 4]));
    }
  }

  // faq: a big question mark.
  {
    const st = piece(7, [1.7, 1.3, -1.0]);
    const q = questionMark();
    holder(st, q, [1.7, 1.3, -1.0]);
    anim.push(t => { q.rotation.y = Math.sin(t * 0.7) * 0.6; q.position.y = Math.sin(t * 1.2) * 0.08; });
  }

  // book: a calendar with a check mark, at golden hour.
  {
    const st = piece(8, [1.25, 0.6, -0.5]);
    const cal = buildCalendar();
    holder(st, cal, [1.25, 0.05, -0.5], 0.9, -0.45);
    upgrade(cal, MODEL_FILES.calendar, 1.25, m => { m.rotation.y = 0.2; });
  }

  // Water across the whole route.
  const segs = tier === 'low' ? 90 : tier === 'mid' ? 160 : 220;
  const water = new T.Mesh(new T.PlaneGeometry(150, 150, segs, segs), waterMaterial());
  water.rotation.x = -Math.PI / 2;
  water.position.set(2, 0.08, -28);
  scene.add(water);
  const wu = (water.material as any).uniforms;

  // Drifting motes along the route, tinted by each section's light.
  const count = tier === 'high' ? 1400 : tier === 'mid' ? 700 : 260;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = -12 + Math.random() * 28;
    pos[i * 3 + 1] = Math.random() * 7;
    pos[i * 3 + 2] = 8 - Math.random() * 72;
    speed[i] = 0.06 + Math.random() * 0.2;
  }
  const dustGeo = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pos, 3));
  // Round soft motes drawn in the shader (point sprites from a texture showed as squares on some drivers).
  const dustMat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { color: { value: new T.Color('#ffffff') }, uSize: { value: (tier === 'low' ? 0.07 : 0.05) * 420 }, uFogColor: fogU.color, uFogNear: fogU.near, uFogFar: fogU.far },
    vertexShader: 'uniform float uSize; varying float vD; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_PointSize = uSize / max(vD, 0.5); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float uFogNear; uniform float uFogFar; varying float vD; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, r); a *= a; a *= 1.0 - smoothstep(uFogNear, uFogFar * 1.3, vD); gl_FragColor = vec4(color * a * 0.9, a); }',
  });
  const dust = new T.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // --- the shot: one spline for the camera, one for its aim, one for the duck --
  const V = (a: number[]) => new T.Vector3(a[0], a[1], a[2]);
  function buildPath(narrow: boolean) {
    const cams = STATIONS.map(st => V(st.at).add(new T.Vector3(st.cam[0] * (narrow ? 0.6 : 1), st.cam[1] + (narrow ? 0.3 : 0), st.cam[2] * (narrow ? 1.22 : 1))));
    const looks = STATIONS.map(st => V(st.at).add(V(st.look)));
    return { cam: new T.CatmullRomCurve3(cams, false, 'centripetal'), look: new T.CatmullRomCurve3(looks, false, 'centripetal') };
  }
  const paths = { wide: buildPath(false), narrow: buildPath(true) };
  const duckPath = new T.CatmullRomCurve3(STATIONS.map(st => V(st.at)), false, 'centripetal');
  const N = STATIONS.length - 1;

  // Light presets, pre-parsed so blending costs nothing per frame.
  const C = (h: string) => new T.Color(h);
  const LP = STATIONS.map(st => {
    const l = st.light;
    return { ...l, key: C(l.key), rim: C(l.rim), sky: C(l.sky), ground: C(l.ground), top: C(l.top), horizon: C(l.horizon), sun: C(l.sun), fog: C(l.fog), deep: C(l.deep), dust: C(l.dust), keyDir: V(l.keyDir).normalize() };
  });
  const tmpC = new T.Color(), tmpV = new T.Vector3();
  const lerpC = (out: any, a: any, b: any, f: number) => out.copy(a).lerp(b, f);
  function applyLight(s: number, intro: number) {
    const i = Math.min(Math.floor(s), N), j = Math.min(i + 1, N), f = smooth(s - i);
    const A = LP[i], B = LP[j];
    const n = (k: keyof Light) => (A[k] as number) + ((B[k] as number) - (A[k] as number)) * f;
    lerpC(key.color, A.key, B.key, f); key.intensity = n('keyI') * (0.35 + 0.65 * intro);
    lerpC(rim.color, A.rim, B.rim, f); rim.intensity = n('rimI') * intro;
    lerpC(hemi.color, A.sky, B.sky, f); lerpC(hemi.groundColor, A.ground, B.ground, f); hemi.intensity = n('hemiI') * (0.4 + 0.6 * intro);
    const su = (sky.material as any).uniforms;
    lerpC(su.uTop.value, A.top, B.top, f); lerpC(su.uHorizon.value, A.horizon, B.horizon, f); lerpC(su.uSun.value, A.sun, B.sun, f);
    su.uStars.value = n('stars');
    lerpC(scene.fog.color, A.fog, B.fog, f);
    fogU.color.value.copy(scene.fog.color);
    scene.fog.near = fogU.near.value = n('fogNear');
    scene.fog.far = fogU.far.value = n('fogFar');
    lerpC(wu.uDeep.value, A.deep, B.deep, f);
    lerpC(wu.uSky.value, A.horizon, B.horizon, f);
    lerpC(dustMat.uniforms.color.value, A.dust, B.dust, f);
    const dir = tmpV.copy(A.keyDir).lerp(B.keyDir, f).normalize();
    su.uSunDir.value.set(dir.x, Math.max(0.08, dir.y * 0.35), dir.z).normalize();
    wu.uSunDir.value.copy(su.uSunDir.value);
    renderer.toneMappingExposure = n('exposure') * (0.15 + 0.85 * intro);
    if (bloom) bloom.strength = n('bloom') * (0.6 + 0.4 * intro);
    return dir;
  }

  // --- state -------------------------------------------------------------
  let s = 0, sTarget = 0, sPrev = 0, vel = 0, velPrev = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let speaking = 0, nod = 0;
  let running = true, visible = true;
  const clock = new T.Clock();
  const look = new T.Vector3(), camPos = new T.Vector3(), aim = new T.Vector3(), tA = new T.Vector3(), tB = new T.Vector3();
  const sectionEls = STATIONS.map(st => document.getElementById(st.id));
  // Opening: 0 -> 1 over OPEN_SECONDS. Skipped by scrolling, reduced motion, or arriving mid-page.
  let open = reducedMotion || window.scrollY > 40 ? 1 : 0;
  let openStarted = false, introSent = false;
  let paused = false, pauseT = 0;
  let squash = 0, squashV = 0, arrived = -1, arriveT = 0, lookYaw = 0;
  let narrow = window.innerWidth < 640, vw = 1, vh = 1;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    narrow = w < 640; vw = w; vh = h;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
    }
    camera.aspect = w / h;
    camera.fov = narrow ? 54 : 42;
    camera.updateProjectionMatrix();
  }

  /** Hold on each set piece while its section is read, then glide to the next. */
  function readScroll() {
    const mid = window.innerHeight * 0.5;
    const tops = sectionEls.map(el => (el ? el.getBoundingClientRect().top - mid : Infinity));
    let i = 0;
    for (let k = 0; k < tops.length; k++) if (tops[k] <= 0) i = k;
    const next = tops[i + 1];
    if (i >= STATIONS.length - 1 || next === undefined || !isFinite(next)) { sTarget = i; return; }
    const span = next - tops[i];
    const f = span > 0 ? -tops[i] / span : 0;
    sTarget = i + smooth(clamp01((f - 0.5) / 0.5));
  }

  function skipOpening() {
    if (open >= 1) return;
    open = 1;
    landHeadline();
  }
  function landHeadline() {
    if (introSent) return;
    introSent = true;
    window.dispatchEvent(new CustomEvent('scene:intro-done'));
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime - pauseT;
    const animate = !reducedMotion && !paused;
    if (paused) { pauseT += dt; }
    if (!openStarted && duckReady) { openStarted = true; }
    if (openStarted && open < 1) { open = Math.min(1, open + dt / OPEN_SECONDS); if (open > 0.82) landHeadline(); if (open >= 1) landHeadline(); }
    const o = open;
    const intro = smooth(clamp01(o / 0.55));

    sPrev = s;
    s += (sTarget - s) * (reducedMotion ? 1 : Math.min(1, dt * 2.6));
    if (Math.abs(sTarget - s) < 1e-4) s = sTarget;
    velPrev = vel;
    vel = dt > 0 ? (s - sPrev) / dt : 0;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.5);

    const u = s / N;
    const path = narrow ? paths.narrow : paths.wide;
    path.cam.getPoint(u, camPos);
    path.look.getPoint(u, look);
    const base = duckPath.getPoint(u, new T.Vector3());

    // Handheld drift scaled to how still the camera is, plus desktop parallax.
    const still = 1 - clamp01(Math.abs(vel) * 3);
    const sway = animate ? 1 : 0;
    camPos.x += (Math.sin(t * 0.37) * 0.05 + Math.sin(t * 0.91) * 0.02) * still * sway + pointer.x * 0.3;
    camPos.y += (Math.sin(t * 0.53 + 1) * 0.035) * still * sway + pointer.y * 0.18;

    // Opening: start low by the water, close on the spot where the duck surfaces, then pull back into the hero frame.
    if (o < 1) {
      const k = smooth(clamp01((o - 0.08) / 0.92));
      const start = tA.set(base.x + 0.9, 0.42, base.z + 2.6);
      const startLook = tB.set(base.x - 0.2, 0.55, base.z);
      camPos.lerpVectors(start, camPos, k);
      look.lerpVectors(startLook, look, k);
    }
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    // Framing: shift the picture so the subject sits in the space the words leave free.
    {
      const i0 = Math.min(Math.floor(s), N), i1 = Math.min(i0 + 1, N), ff = smooth(s - i0);
      const a = narrow ? STATIONS[i0].frm : STATIONS[i0].fr, b = narrow ? STATIONS[i1].frm : STATIONS[i1].fr;
      const fx = a[0] + (b[0] - a[0]) * ff, fy = a[1] + (b[1] - a[1]) * ff;
      camera.setViewOffset(vw, vh, (0.5 - fx) * vw, (0.5 - fy) * vh, vw, vh);
    }
    // A touch of roll into turns, only while moving.
    if (animate) {
      const e = 0.02, u0 = Math.max(0, u - e), u1 = Math.min(1, u + e);
      const d0 = path.look.getPoint(u0, tA).sub(path.cam.getPoint(u0, aim)), d1 = path.look.getPoint(u1, tB).sub(path.cam.getPoint(u1, aim));
      const turnRate = Math.atan2(d0.x * d1.z - d0.z * d1.x, d0.x * d1.x + d0.z * d1.z);
      camera.rotateZ(Math.max(-0.07, Math.min(0.07, -turnRate * 0.9)) * clamp01(Math.abs(vel) * 2.5));
    }

    const ldir = applyLight(s, o >= 1 ? 1 : 0.25 + 0.75 * smooth(clamp01((o - 0.1) / 0.6)));
    key.position.copy(base).addScaledVector(ldir, 10);
    key.target.position.copy(base);
    rim.position.set(base.x - ldir.x * 8, 4.5, base.z - Math.abs(ldir.z) * 8 - 3);
    rim.target.position.copy(base);
    sky.position.copy(camera.position);

    // --- the duck ---------------------------------------------------------
    duckRig.position.set(base.x, 0, base.z);
    const i = Math.min(Math.floor(s + 0.5), N);
    const settled = Math.abs(sTarget - s) < 0.02 && Math.abs(s - Math.round(s)) < 0.02;
    if (settled && arrived !== i) { arrived = i; arriveT = t; window.dispatchEvent(new CustomEvent('scene:arrive', { detail: { index: i, id: STATIONS[i].id } })); }
    if (!settled && Math.abs(s - Math.round(s)) > 0.08) arrived = -1;
    const st = STATIONS[i];
    const toCam = Math.atan2(-(camera.position.z - base.z), camera.position.x - base.x) + st.turn;
    const tan = duckPath.getTangent(clamp01(u), tA);
    const heading = Math.atan2(-tan.z, tan.x) * (Math.sign(vel) >= 0 ? 1 : 1) + (vel < 0 ? Math.PI : 0);
    const swim = clamp01(Math.abs(vel) * 2.2);
    // On arrival: look at the set piece for a beat, then back at you.
    let want = toCam;
    const pc = pieces.find(p => p.i === i);
    if (pc && arrived === i && t - arriveT < 1.6 && open >= 1) {
      const toPiece = Math.atan2(-(pc.focus.z - base.z), pc.focus.x - base.x);
      want = angLerp(toCam, toPiece, smooth(clamp01((t - arriveT) / 0.35)) * (1 - smooth(clamp01((t - arriveT - 1.1) / 0.5))));
    }
    want = angLerp(want, heading, swim);
    if (o < 1) want = angLerp(heading + Math.PI * 0.6, toCam, smooth(clamp01((o - 0.45) / 0.35)));
    lookYaw = angLerp(lookYaw, want, Math.min(1, dt * (o < 1 ? 8 : 4)));
    duckRig.rotation.y = lookYaw + (animate ? Math.sin(t * 0.6) * 0.06 * (1 - swim) : 0) + pointer.x * 0.1;

    // Squash before setting off (acceleration), stretch while swimming, spring back on arrival.
    const acc = dt > 0 ? (Math.abs(vel) - Math.abs(velPrev)) / dt : 0;
    const squashTarget = Math.max(-0.12, Math.min(0.1, -acc * 0.05)) + swim * 0.04;
    squashV += ((squashTarget - squash) * 140 - squashV * 11) * dt;
    squash += squashV * dt;
    // Rising out of the water in the opening, with an overshoot.
    const rise = o >= 1 ? 1 : easeOutBack(clamp01((o - 0.12) / 0.38), 2.2);
    const riseY = (rise - 1) * 1.4;
    const sy = 1 - squash, sxz = 1 + squash * 0.6;
    duckPose.scale.set(sxz, sy, sxz);
    nod += ((speaking > 0.05 ? Math.sin(t * 7) * 0.09 * speaking : 0) - nod) * Math.min(1, dt * 10);
    duckPose.rotation.z = (animate ? Math.sin(t * 1.1) * 0.035 + swim * Math.sin(t * 6) * 0.04 : 0) + nod;
    duckPose.position.y = riseY + 0.02 + (animate ? Math.sin(t * 1.4) * 0.045 + swim * Math.abs(Math.sin(t * 5)) * 0.035 : 0);
    if (bill) bill.position.y = 1.4 - speaking * Math.abs(Math.sin(t * 14)) * 0.06;

    // The glint: a star that sweeps across the lenses once, near the end of the opening.
    const gk = clamp01((o - 0.72) / 0.18);
    const gm = glint.material as any;
    gm.opacity = o < 1 && gk > 0 && gk < 1 ? Math.sin(gk * Math.PI) : 0;
    glint.position.set(GLINT.x, GLINT.y, GLINT.z0 + (GLINT.z1 - GLINT.z0) * gk);
    glint.material.rotation = gk * 1.2;

    // Set pieces pop in with overshoot as their section arrives, and settle away after.
    for (const p of pieces) {
      const target = o >= 1 && Math.abs(s - p.i) < 0.62 ? 1 : 0;
      if (reducedMotion) { p.x = target; p.v = 0; }
      else { p.v += ((target - p.x) * 90 - p.v * (target ? 9 : 16)) * dt; p.x += p.v * dt; }
      const k = Math.max(0, p.x);
      p.g.scale.setScalar(Math.max(0.0001, k));
      p.g.visible = k > 0.002;
    }
    for (const gl of glowLights) {
      const near = 1 - clamp01(Math.abs(s - gl.i) / 0.9);
      gl.light.intensity = gl.base * near * (gl.light.userData.flicker ?? 1);
    }

    const tt = reducedMotion ? 0 : t;
    for (const fn of anim) fn(tt);
    wireMat.opacity = 0.45 + speaking * 0.4;

    if (animate) {
      const pp = dustGeo.attributes.position.array as Float32Array;
      for (let k = 0; k < count; k++) { pp[k * 3 + 1] += speed[k] * dt; if (pp[k * 3 + 1] > 7) pp[k * 3 + 1] = 0; }
      dustGeo.attributes.position.needsUpdate = true;
    }
    wu.uTime.value = tt;
    wu.uPulse.value = speaking;
    const fp = pc ? pc.focus : base;
    wu.uFocus.value.set(fp.x, fp.z);
    wu.uDuck.value.set(base.x, base.z);
    const hd = Math.atan2(-Math.sin(lookYaw), Math.cos(lookYaw));
    wu.uHead.value.set(Math.cos(hd), Math.sin(hd));
    wu.uSpeed.value = swim;
    wu.uRing.value = o < 1 ? clamp01((o - 0.1) / 0.75) : -1;
    wu.uRingC.value.set(base.x, base.z);
    (sky.material as any).uniforms.uTime.value = tt;
    speaking = Math.max(0, speaking - dt * 0.8);

    if (composer) { grain.uniforms.uTime.value = t; composer.render(dt); }
    else renderer.render(scene, camera);
  }

  function loop() { if (!running) return; if (visible) frame(); requestAnimationFrame(loop); }

  const onScroll = () => { readScroll(); if (window.scrollY > 8) skipOpening(); if (reducedMotion) frame(); };
  const onSkip = () => skipOpening();
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  const onResize = () => { resize(); readScroll(); if (reducedMotion) frame(); };
  const onVis = () => { visible = !document.hidden; };
  const onPause = (e: Event) => { paused = !!(e as CustomEvent).detail?.paused; skipOpening(); };
  const onSpeak = () => { speaking = 1; if (reducedMotion) frame(); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('wheel', onSkip, { passive: true });
  window.addEventListener('touchmove', onSkip, { passive: true });
  window.addEventListener('keydown', onSkip);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('guide:speaking', onSpeak);
  window.addEventListener('scene:pause', onPause);
  if (!reducedMotion && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; });
  io.observe(canvas);

  if (/[?&]scene-debug/.test(location.search)) (window as any).__scene = { composer, renderer, duckRig, duckPose, get duckBody() { return duckBody; }, glint, camera, STATIONS, paths, set open(v: number) { open = v; }, get open() { return open; } };
  resize();
  readScroll();
  s = sTarget;
  // Wait for the duck (or its built-in stand-in) before the first frame, so the opening never starts empty.
  await Promise.race([duckLoad, new Promise(r => setTimeout(r, 2500))]);
  duckReady = true;
  if (open >= 1) landHeadline();
  if (reducedMotion) frame(); else loop();

  return () => {
    running = false;
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onSkip);
    window.removeEventListener('touchmove', onSkip);
    window.removeEventListener('keydown', onSkip);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('guide:speaking', onSpeak);
    renderer.dispose();
  };
}

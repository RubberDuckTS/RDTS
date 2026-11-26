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
 * face +z; the duck's beak has to point down +x, so it turns 90. An optional
 * /models/manifest.json ({"duck-guide.glb": {"yaw": 45}}) overrides these
 * without a code change.
 */
const MODEL_YAW: Record<string, number> = { [MODEL_FILES.duck]: 90 };

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
const outlineCache = new Map<string, any>();

function toon(color: string, extra: Record<string, unknown> = {}) {
  return new T.MeshToonMaterial({ color: new T.Color(color), gradientMap: gradient, ...extra });
}

function outlineMat(push: number) {
  const k = push.toFixed(4);
  let m = outlineCache.get(k);
  if (!m) {
    m = new T.ShaderMaterial({
      side: T.BackSide,
      uniforms: { uColor: { value: new T.Color(LOGO.ink) }, uPush: { value: push } },
      vertexShader: 'uniform float uPush; void main(){ vec3 p = position + normal * uPush; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }',
    });
    outlineCache.set(k, m);
  }
  return m;
}

/** Outline for smooth shapes (spheres, tori, models): push the hull out along normals. */
function ink(m: any, push = 0.035) {
  const o = new T.Mesh(m.geometry, outlineMat(push));
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
async function tryModel(file: string, size: number): Promise<any | null> {
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
    for (const o of meshes) {
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      o.material = new T.MeshToonMaterial({
        color: src?.color ?? new T.Color('#ffffff'), map: src?.map ?? null, gradientMap: gradient,
        emissive: src?.emissive ?? new T.Color(0), emissiveMap: src?.emissiveMap ?? null, emissiveIntensity: src?.emissiveIntensity ?? 1,
      });
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.getWorldScale(ws);
      ink(o, 0.022 / Math.max(ws.x, 1e-4));
    }
    return holder;
  } catch { return null; }
}

/** Replace a set piece's built-in shapes with a model when the file exists. */
function upgrade(group: any, file: string, size: number, then?: (m: any) => void) {
  tryModel(file, size).then(m => {
    if (!m) return;
    group.clear();
    group.userData = {};
    group.add(m);
    then?.(m);
  });
}

// ---------------------------------------------------------------------------
// Water: a dark grid with ripples around whichever set piece is in focus.
// ---------------------------------------------------------------------------
function waterMaterial() {
  return new T.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 }, uPulse: { value: 0 }, uFocus: { value: new T.Vector2() },
      uColor: { value: new T.Color(LOGO.yellow) }, uInk: { value: new T.Color(LOGO.night) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform vec2 uFocus;
      varying vec2 vXZ; varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        float d = length(w.xz - uFocus);
        float h = sin(d * 2.4 - uTime * 1.6) * 0.045 * exp(-d * 0.18)
                + sin(w.x * 0.7 + uTime * 0.5) * 0.03 + cos(w.z * 0.9 - uTime * 0.4) * 0.03;
        w.y += h; vH = h; vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uPulse; uniform vec2 uFocus; uniform vec3 uColor; uniform vec3 uInk;
      varying vec2 vXZ; varying float vH;
      void main() {
        vec2 p = vXZ * 0.5;
        vec2 g = abs(fract(p) - 0.5) / fwidth(p);
        float grid = 1.0 - min(min(g.x, g.y), 1.0);
        float d = length(vXZ - uFocus);
        float ring = smoothstep(0.08, 0.0, abs(fract(d * 0.22 - uTime * 0.25) - 0.5) - 0.44);
        float fade = exp(-d * 0.11);
        vec3 col = uInk + uColor * (grid * 0.10 + ring * 0.22 * (0.6 + uPulse)) * fade + uColor * vH * 0.6 * fade;
        gl_FragColor = vec4(col, 0.85 * fade + grid * 0.15 * fade);
      }`,
  });
}

// ---------------------------------------------------------------------------
// Stations: where each homepage section's set piece sits, and how the camera
// frames it. Camera offsets are from the station, and the camera looks down -z,
// so +x is screen-right, away from the text column.
// ---------------------------------------------------------------------------
type Station = { id: string; at: number[]; cam: number[]; look: number[]; turn: number };
const DEF_CAM = [1.0, 1.2, 5.6], DEF_LOOK = [-1.7, 0.6, 0];
const WIDE_CAM = [0.7, 2.7, 7.2], WIDE_LOOK = [-1.3, 0.6, 0];
export const STATIONS: Station[] = [
  { id: 's-hero', at: [0, 0, 0], cam: [1.2, 1.15, 5.6], look: [-1.7, 0.55, 0], turn: 0.75 },
  { id: 's-overpay', at: [5, 0, -7], cam: DEF_CAM, look: DEF_LOOK, turn: 0.45 },
  { id: 's-offers', at: [10, 0, -14], cam: [1.4, 1.6, 6.2], look: [-1.3, 0.8, 0], turn: 0.5 },
  { id: 's-services', at: [5, 0, -21], cam: WIDE_CAM, look: WIDE_LOOK, turn: 0.3 },
  { id: 's-range', at: [-1, 0, -28], cam: WIDE_CAM, look: WIDE_LOOK, turn: 0.3 },
  { id: 's-proof', at: [-6, 0, -35], cam: DEF_CAM, look: DEF_LOOK, turn: 0.55 },
  { id: 's-process', at: [-1, 0, -42], cam: [1.2, 1.9, 5.8], look: [-1.4, 0.4, 0], turn: 0.4 },
  { id: 's-faq', at: [4, 0, -49], cam: DEF_CAM, look: DEF_LOOK, turn: 0.45 },
  { id: 's-book', at: [0, 0, -56], cam: [0.0, 1.3, 4.6], look: [0, 0.8, 0], turn: 0 },
];

function smooth(t: number) { return t * t * (3 - 2 * t); }
function angLerp(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export async function startDuckScene(canvas: HTMLCanvasElement, opts: { tier: Tier; reducedMotion: boolean }) {
  await loadThree();
  const { tier, reducedMotion } = opts;
  gradient = new T.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, T.RedFormat);
  gradient.minFilter = gradient.magFilter = T.NearestFilter;
  gradient.needsUpdate = true;

  const renderer = new T.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
  const maxDpr = tier === 'high' ? 1.75 : tier === 'mid' ? 1.4 : 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = T.SRGBColorSpace;

  const scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color(LOGO.night), 9, 24);
  const camera = new T.PerspectiveCamera(42, 1, 0.1, 80);
  scene.add(new T.HemisphereLight(0xfff4d6, 0x1a1d24, 1.4));
  const key = new T.DirectionalLight(0xffffff, 2.4);
  scene.add(key);
  scene.add(key.target);

  // --- the duck guide -------------------------------------------------------
  const duckRig = new T.Group();           // swims between stations
  const built = buildDuck(tier);
  let duckBody = built.duck;               // bobs and nods inside the rig
  let bill: any = built.bill;
  duckRig.add(duckBody);
  scene.add(duckRig);
  tryModel(MODEL_FILES.duck, 1.25).then(m => {
    if (!m) return;
    m.position.y -= 0.12;
    duckRig.remove(duckBody);
    duckBody = new T.Group();
    duckBody.add(m);
    duckRig.add(duckBody);
    bill = null;
  });

  const stationGroup = (i: number) => { const g = new T.Group(); g.position.set(...STATIONS[i].at); scene.add(g); return g; };
  const anim: Array<(t: number) => void> = [];
  const holder = (st: any, piece: any, pos: number[], scale = 1, rotY = 0) => {
    const h = new T.Group();
    h.position.set(pos[0], pos[1], pos[2]);
    h.scale.setScalar(scale);
    h.rotation.y = rotY;
    h.add(piece);
    st.add(h);
    return h;
  };

  // overpay: a cloud with a coin slot, swallowing coins.
  {
    const st = stationGroup(1);
    const cloud = buildCloud();
    const ch = holder(st, cloud, [1.7, 2.0, -1.3]);
    upgrade(cloud, MODEL_FILES.cloud, 1.8, m => { m.position.y -= 0.6; });
    const coinMat = toon(LOGO.orange);
    const coins: any[] = [];
    for (let i = 0; i < 7; i++) {
      const c = inkScaled(mesh(new T.CylinderGeometry(0.12, 0.12, 0.035, 24), coinMat), 0.12);
      coins.push(c);
      st.add(c);
    }
    anim.push(t => {
      coins.forEach((c, i) => {
        const k = (t * 0.22 + i / coins.length) % 1;
        c.position.set(0.7 + k * 1.0 + Math.sin(k * 6 + i) * 0.08, 0.5 + k * 2.15, -0.3 - k * 1.0);
        c.rotation.set(Math.PI / 2, 0, t * 2 + i);
        c.scale.setScalar(k > 0.85 ? (1 - k) / 0.15 : 1);
      });
      ch.position.y = 2.0 + Math.sin(t * 0.8) * 0.06;
    });
  }

  // offers: three numbered steps up to a small AI headquarters.
  {
    const st = stationGroup(2);
    const stepMat = toon(LOGO.slate);
    [[1.0, 0.3, -0.4, 0.42], [2.0, 0.75, -1.1, 0.5], [3.1, 1.3, -1.9, 0.62]].forEach(([x, h, z, r], i) => {
      const top = toon('#ffffff', { map: numberFace(i + 1) });
      st.add(inkScaled(mesh(new T.CylinderGeometry(r, r, h, 40), [stepMat, top, stepMat], [x, h / 2, z]), 0.04));
    });
    const hq = buildHQ();
    holder(st, hq, [3.1, 1.3, -1.9], 0.9);
    upgrade(hq, MODEL_FILES.hq, 1.3);
    anim.push(t => { const d = hq.userData.spin; if (d) d.rotation.z = t * 0.8; });
  }

  // Lines from the duck to each item, like an agent network.
  const wireMat = new T.LineBasicMaterial({ color: new T.Color(LOGO.yellow), transparent: true, opacity: 0.4 });
  function wired(st: any, items: any[]) {
    const lines = items.map(() => {
      const line = new T.Line(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)), wireMat);
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
    const st = stationGroup(3);
    const badges = SERVICE_ICONS.map(n => { const b = badge(n); st.add(b); return b; });
    const sync = wired(st, badges);
    anim.push(t => {
      badges.forEach((b, i) => {
        const a = (i / badges.length) * Math.PI * 2 + t * 0.18;
        b.position.set(Math.cos(a) * 2.4, 1.1 + Math.sin(a * 2 + t * 0.7) * 0.18, Math.sin(a) * 2.4);
        b.lookAt(camera.position);
      });
      sync();
    });
  }

  // range: six tiles fanned behind the duck.
  {
    const st = stationGroup(4);
    const tiles = RANGE_ICONS.map((n, i) => {
      const tl = tile(n);
      const a = Math.PI * (0.12 + (i / (RANGE_ICONS.length - 1)) * 0.76);
      tl.userData.base = [Math.cos(a) * 2.3 + 0.6, 1.0 + (i % 2) * 0.55, -Math.sin(a) * 1.6 - 0.3];
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

  // proof: the local AI rig.
  {
    const st = stationGroup(5);
    const rig = buildRig();
    holder(st, rig, [1.6, 0, -0.9], 1.15, -0.5);
    upgrade(rig, MODEL_FILES.rig, 1.7);
    anim.push(t => {
      (rig.userData.fans || []).forEach((f: any, i: number) => { f.rotation.x = t * (4 + i); });
      if (rig.userData.glow) rig.userData.glow.emissiveIntensity = 0.7 + Math.sin(t * 3) * 0.25;
    });
  }

  // process: three numbered stepping stones joined by a dotted path.
  {
    const st = stationGroup(6);
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
    const st = stationGroup(7);
    const q = questionMark();
    holder(st, q, [1.7, 1.3, -1.0]);
    anim.push(t => { q.rotation.y = Math.sin(t * 0.7) * 0.6; q.position.y = Math.sin(t * 1.2) * 0.08; });
  }

  // book: a calendar with a check mark.
  {
    const st = stationGroup(8);
    const cal = buildCalendar();
    holder(st, cal, [1.25, 0.05, -0.5], 0.9, -0.45);
    upgrade(cal, MODEL_FILES.calendar, 1.2);
  }

  // Water across the whole route.
  const water = new T.Mesh(new T.PlaneGeometry(90, 90, tier === 'low' ? 70 : 160, tier === 'low' ? 70 : 160), waterMaterial());
  water.rotation.x = -Math.PI / 2;
  water.position.set(2, 0.08, -28);
  scene.add(water);

  // Rising "data dust" along the route.
  const count = tier === 'high' ? 1600 : tier === 'mid' ? 800 : 300;
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = -12 + Math.random() * 28;
    pos[i * 3 + 1] = Math.random() * 7;
    pos[i * 3 + 2] = 6 - Math.random() * 68;
    speed[i] = 0.08 + Math.random() * 0.25;
  }
  const dustGeo = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pos, 3));
  const dot = faceTexture((g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,220,140,0.6)'); grd.addColorStop(1, 'rgba(253,208,47,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  }, 64);
  scene.add(new T.Points(dustGeo, new T.PointsMaterial({
    size: tier === 'low' ? 0.08 : 0.06, map: dot, transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, color: new T.Color(LOGO.yellow), opacity: 0.7,
  })));

  // --- state -------------------------------------------------------------
  let s = 0, sTarget = 0;               // station index + travel fraction
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let speaking = 0;
  let running = true, visible = true;
  const clock = new T.Clock();
  const look = new T.Vector3();
  const sectionEls = STATIONS.map(st => document.getElementById(st.id));

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 640 ? 54 : 42;
    camera.updateProjectionMatrix();
  }

  /** Hold on each set piece while its section is read, then swim to the next. */
  function readScroll() {
    const mid = window.innerHeight * 0.5;
    const tops = sectionEls.map(el => (el ? el.getBoundingClientRect().top - mid : Infinity));
    let i = 0;
    for (let k = 0; k < tops.length; k++) if (tops[k] <= 0) i = k;
    const next = tops[i + 1];
    if (i >= STATIONS.length - 1 || next === undefined || !isFinite(next)) { sTarget = i; return; }
    const span = next - tops[i];
    const f = span > 0 ? -tops[i] / span : 0;
    sTarget = i + smooth(Math.min(1, Math.max(0, (f - 0.55) / 0.45)));
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const animate = !reducedMotion;
    s += (sTarget - s) * (reducedMotion ? 1 : Math.min(1, dt * 3));
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);

    const i = Math.min(Math.floor(s), STATIONS.length - 1);
    const j = Math.min(i + 1, STATIONS.length - 1);
    const f = s - i;
    const A = STATIONS[i], B = STATIONS[j];
    const narrow = window.innerWidth < 640;
    const mix = (a: number[], b: number[]) => a.map((v, k) => v + (b[k] - v) * f);
    const base = mix(A.at, B.at), cam = mix(A.cam, B.cam), lk = mix(A.look, B.look);
    camera.position.set(
      base[0] + cam[0] * (narrow ? 0.55 : 1) + pointer.x * 0.35,
      cam[1] + pointer.y * 0.2 + (narrow ? 0.35 : 0),
      base[2] + cam[2] * (narrow ? 1.25 : 1),
    );
    const heroLift = narrow ? 1.05 * (1 - smooth(Math.min(s, 1))) : 0;
    look.set(base[0] + lk[0] * (narrow ? 0.1 : 1), lk[1] - heroLift, base[2] + lk[2]);
    camera.lookAt(look);
    key.position.set(base[0] + 3, 6, base[2] + 5);
    key.target.position.set(base[0], 0, base[2]);

    // The duck swims the route: pointing down the path mid-swim, turned to you at each stop.
    duckRig.position.set(base[0], 0, base[2]);
    const toCam = Math.atan2(-(camera.position.z - base[2]), camera.position.x - base[0]) + A.turn + (B.turn - A.turn) * f;
    const heading = Math.atan2(-(B.at[2] - A.at[2]), B.at[0] - A.at[0]);
    const swim = i === j ? 0 : Math.sin(Math.PI * f);
    duckRig.rotation.y = angLerp(toCam, heading, swim) + (animate ? Math.sin(t * 0.6) * 0.1 * (1 - swim) : 0) + pointer.x * 0.12;
    duckBody.position.y = 0.02 + (animate ? Math.sin(t * 1.4) * 0.05 + swim * Math.abs(Math.sin(t * 5)) * 0.04 : 0);
    duckBody.rotation.z = animate ? Math.sin(t * 1.1) * 0.04 + speaking * Math.sin(t * 9) * 0.05 : 0;
    if (bill) bill.position.y = 1.4 - speaking * Math.abs(Math.sin(t * 14)) * 0.06;
    else duckBody.position.y += speaking * Math.abs(Math.sin(t * 10)) * 0.03;

    const tt = animate ? t : 0;
    for (const fn of anim) fn(tt);
    wireMat.opacity = 0.3 + speaking * 0.4;

    if (animate) {
      const p = dustGeo.attributes.position.array as Float32Array;
      for (let k = 0; k < count; k++) { p[k * 3 + 1] += speed[k] * dt; if (p[k * 3 + 1] > 7) p[k * 3 + 1] = 0; }
      dustGeo.attributes.position.needsUpdate = true;
    }
    const wm = water.material as any;
    wm.uniforms.uTime.value = tt;
    wm.uniforms.uPulse.value = speaking;
    wm.uniforms.uFocus.value.set(base[0], base[2]);
    speaking = Math.max(0, speaking - dt * 0.8);

    renderer.render(scene, camera);
  }

  function loop() { if (!running) return; if (visible) frame(); requestAnimationFrame(loop); }

  const onScroll = () => { readScroll(); if (reducedMotion) frame(); };
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  };
  const onResize = () => { resize(); readScroll(); if (reducedMotion) frame(); };
  const onVis = () => { visible = !document.hidden; };
  const onSpeak = () => { speaking = 1; if (reducedMotion) frame(); };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('guide:speaking', onSpeak);
  if (!reducedMotion && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; });
  io.observe(canvas);

  resize();
  readScroll();
  s = sTarget;
  if (reducedMotion) frame(); else loop();

  return () => {
    running = false;
    io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('guide:speaking', onSpeak);
    renderer.dispose();
  };
}

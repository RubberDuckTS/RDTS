/**
 * Optional sound for the homepage scene, made in Web Audio (no audio files):
 * soft water ambience and a light tick each time the camera arrives at a set
 * piece. Off by default; starts only from the speaker button, never by itself.
 * A hidden tab goes quiet.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = false;
let lapTimer = 0;

function noiseBuffer(c: AudioContext, seconds = 2) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}

function build() {
  const c = new AudioContext();
  const m = c.createGain();
  m.gain.value = 0;
  m.connect(c.destination);
  // Bed: brown noise, band-limited, with a slow swell like water against a hull.
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'lowpass'; bp.frequency.value = 520; bp.Q.value = 0.4;
  const swell = c.createGain();
  swell.gain.value = 0.32;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoAmt = c.createGain();
  lfoAmt.gain.value = 0.12;
  lfo.connect(lfoAmt).connect(swell.gain);
  src.connect(bp).connect(swell).connect(m);
  src.start(); lfo.start();
  ctx = c; master = m;
}

/** Little laps of water now and then. */
function lap() {
  if (!ctx || !master || !on) return;
  const c = ctx, now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.6);
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 900; f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.09, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  src.connect(f).connect(g).connect(master);
  src.start(now); src.stop(now + 0.6);
  lapTimer = window.setTimeout(lap, 1400 + Math.random() * 2600);
}

/** A light tick, like a drop on water, when the camera arrives at a set piece. */
export function tick() {
  if (!ctx || !master || !on) return;
  const c = ctx, now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(620, now);
  o.frequency.exponentialRampToValueAtTime(1500, now + 0.07);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  o.connect(g).connect(master);
  o.start(now); o.stop(now + 0.3);
}

export function isOn() { return on; }

export async function setSound(next: boolean) {
  on = next;
  if (on && !ctx) build();
  if (!ctx || !master) return;
  if (on) await ctx.resume();
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(on ? 0.5 : 0, now, 0.25);
  window.clearTimeout(lapTimer);
  if (on) lapTimer = window.setTimeout(lap, 900);
  else window.setTimeout(() => { if (!on) ctx?.suspend(); }, 900);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else if (on) ctx.resume();
});

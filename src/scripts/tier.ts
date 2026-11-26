export type Tier = 'high' | 'mid' | 'low';

/** Pick a quality tier from what the device tells us. */
export function detectTier(): Tier | null {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return null;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return null;
  } catch { return null; }
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  if (mem <= 2 || cores <= 2) return 'low';
  if (small || mem <= 4 || cores <= 4) return 'mid';
  return 'high';
}

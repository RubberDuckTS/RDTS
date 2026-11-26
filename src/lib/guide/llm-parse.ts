/** Pull the first JSON object out of a model reply. Browser-safe. */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    return v && typeof v === 'object' && typeof v.message === 'string' ? v : null;
  } catch {
    return null;
  }
}

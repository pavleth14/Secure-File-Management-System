/** Build a US-biased Google Maps search URL for a repair shop. */
export function buildAutoMapsSearchUrl({ name, address, city, state, zip } = {}) {
  const parts = [name, address, city, state, zip, 'United States']
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

export function resolveRepairShopMapsUrl(shop) {
  if (!shop) return null;
  const stored = String(shop.mapsUrl || '').trim();
  if (stored) return stored;
  const auto = buildAutoMapsSearchUrl(shop);
  return auto || null;
}

export function normalizeMapsUrlInput(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url.replace(/^\/\//, '')}`;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      const err = new Error('Maps link must use http or https');
      err.status = 400;
      throw err;
    }
    return parsed.href;
  } catch (e) {
    if (e.status) throw e;
    const err = new Error(
      'Invalid Maps link URL. Paste a full Google Maps link or use Regenerate (auto).'
    );
    err.status = 400;
    throw err;
  }
}
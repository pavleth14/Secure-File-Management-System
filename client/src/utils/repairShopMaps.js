/** US-biased Google Maps search (fallback when no stored shop link). */
export function buildGoogleMapsSearchUrl(repairShop) {
  const query = String(repairShop || '').trim();
  if (!query) return null;
  const full = query.toLowerCase().includes('united states')
    ? query
    : `${query}, United States`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
}

export function resolveRepairShopLink({ mapsUrl, shopName } = {}) {
  const stored = String(mapsUrl || '').trim();
  if (stored) return stored;
  return buildGoogleMapsSearchUrl(shopName);
}
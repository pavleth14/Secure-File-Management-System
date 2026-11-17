/** Google Maps search for a repair shop name (opens in new tab). */
export function buildGoogleMapsSearchUrl(repairShop) {
  const query = String(repairShop || '').trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
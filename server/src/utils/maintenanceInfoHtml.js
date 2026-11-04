/** Strip scripts and inline event handlers from stored HTML fragments. */
export function sanitizeMaintenanceInfoHtml(html) {
  if (html == null) return '';
  let value = String(html);
  value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  value = value.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  value = value.replace(/javascript:/gi, '');
  return value;
}

export function looksLikeHtml(content) {
  return /<\s*[a-z][\s\S]*>/i.test(String(content || '').trim());
}

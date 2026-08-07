/**
 * Display lead "Date" column as YYYY-MM-DD (date only, no time).
 * createdAt is used only when lead.date is empty (does not affect edit-window logic).
 */
export function formatLeadDisplayDate(dateValue, createdAt) {
  const trimmed = String(dateValue || '').trim();
  if (trimmed) {
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1];
    }

    const mdyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (mdyMatch) {
      const year = mdyMatch[3];
      const month = String(mdyMatch[1]).padStart(2, '0');
      const day = String(mdyMatch[2]).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return trimmed.slice(0, 10);
  }

  if (!createdAt) {
    return '—';
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

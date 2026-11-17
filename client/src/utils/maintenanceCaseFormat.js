/** Board / modal: who last touched the case and when. */
export function formatLastEditedSummary(row) {
  const name = row?.lastEditedByName || row?.createdByName;
  const when = row?.lastEditedAtLabel;
  if (name && when) return `${name} · ${when}`;
  if (name) return name;
  if (when) return when;
  return '—';
}
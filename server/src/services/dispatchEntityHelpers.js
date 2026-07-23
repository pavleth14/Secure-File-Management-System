function normalizeSearchTerm(search) {
  return String(search || '').trim().toLowerCase();
}

function matchesSearch(values, search) {
  if (!search) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(search));
}

export function filterBySearch(items, search, getValues) {
  const term = normalizeSearchTerm(search);
  if (!term) return items;
  return items.filter((item) => matchesSearch(getValues(item), term));
}

export function filterByStatus(items, status, statusField = 'status') {
  if (!status || status === 'all') return items;
  return items.filter((item) => item[statusField] === status);
}

export function parseDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error('Invalid date value');
    err.status = 400;
    throw err;
  }
  return date;
}

export async function assertFolderExists(folderId) {
  if (!folderId) return null;
  const { Folder } = await import('../models/Folder.js');
  const folder = await Folder.findById(folderId);
  if (!folder) {
    const err = new Error('Linked folder not found');
    err.status = 400;
    throw err;
  }
  return folder;
}

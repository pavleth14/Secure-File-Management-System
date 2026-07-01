import { getFileExtension } from '../config/uploadTypes.js';

export function buildMongoSort(sortBy = 'date', sortDir = 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1;
  const map = {
    name: 'originalName',
    size: 'size',
    date: 'createdAt',
  };
  const field = map[sortBy] || 'createdAt';
  return { [field]: dir };
}

export function buildPersonalMongoSort(sortBy = 'date', sortDir = 'desc') {
  const dir = sortDir === 'asc' ? 1 : -1;
  const map = {
    name: 'name',
    size: 'size',
    date: 'createdAt',
  };
  const field = map[sortBy] || 'createdAt';
  return { [field]: dir };
}

export function needsInMemorySort(sortBy) {
  return sortBy === 'uploadedBy' || sortBy === 'extension';
}

function getSortableName(file) {
  return file.originalName || file.name || '';
}

export function sortFiles(files, sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  const sorted = [...files];

  sorted.sort((a, b) => {
    if (sortBy === 'extension') {
      const aExt = getFileExtension(getSortableName(a));
      const bExt = getFileExtension(getSortableName(b));
      if (!aExt && !bExt) return 0;
      if (!aExt) return 1;
      if (!bExt) return -1;
      return aExt.localeCompare(bExt) * dir;
    }

    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = getSortableName(a).localeCompare(getSortableName(b));
        break;
      case 'size':
        cmp = (a.size || 0) - (b.size || 0);
        break;
      case 'uploadedBy': {
        const an = a.uploadedBy?.name || '';
        const bn = b.uploadedBy?.name || '';
        cmp = an.localeCompare(bn);
        break;
      }
      case 'date':
      default:
        cmp = new Date(a.createdAt) - new Date(b.createdAt);
        break;
    }
    return cmp * dir;
  });

  return sorted;
}

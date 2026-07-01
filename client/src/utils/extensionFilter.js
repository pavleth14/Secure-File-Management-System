import { getFileExtension } from './uploadTypes';

export function getFileDisplayName(file) {
  return file?.originalName || file?.name || '';
}

/** Unique extensions (lowercase) from a file list, sorted A→Z. */
export function collectExtensionOptions(files) {
  const extensions = new Set();

  for (const file of files || []) {
    const ext = getFileExtension(getFileDisplayName(file));
    if (ext) extensions.add(ext);
  }

  return [...extensions].sort((a, b) => a.localeCompare(b));
}

/** Client-side extension filter. `selectedExtension` is lowercase or `'all'`. */
export function filterFilesByExtension(files, selectedExtension) {
  if (!selectedExtension || selectedExtension === 'all') {
    return files || [];
  }

  const target = selectedExtension.toLowerCase();
  return (files || []).filter(
    (file) => getFileExtension(getFileDisplayName(file)) === target
  );
}

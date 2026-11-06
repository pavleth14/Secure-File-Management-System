/**
 * Human-friendly sort for mixed alphanumeric IDs (e.g. T-12 before T-100; 145 before 1444).
 * Does not rely on Intl/locale numeric mode (works consistently on Windows Node).
 */
export function compareNaturalStrings(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (sa === sb) return 0;

  const tokenize = (s) => {
    const parts = s.match(/\d+|\D+/g);
    return parts && parts.length ? parts : [s];
  };

  const chunksA = tokenize(sa);
  const chunksB = tokenize(sb);
  const len = Math.max(chunksA.length, chunksB.length);

  for (let i = 0; i < len; i += 1) {
    const x = chunksA[i] ?? '';
    const y = chunksB[i] ?? '';
    const numX = /^\d+$/.test(x) ? BigInt(x) : null;
    const numY = /^\d+$/.test(y) ? BigInt(y) : null;

    if (numX !== null && numY !== null) {
      if (numX < numY) return -1;
      if (numX > numY) return 1;
    } else {
      const cmp = x.localeCompare(y, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }

  return 0;
}

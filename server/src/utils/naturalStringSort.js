/**
 * Sort strings with embedded numbers in human order (e.g. 106, 123, 144, 145 before 1444).
 */
export function compareNaturalStrings(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

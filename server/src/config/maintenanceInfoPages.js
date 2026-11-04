export const MAINTENANCE_INFO_PAGE_SLUGS = [
  'company-info-main',
  'national-accounts-vendor-programs',
];

export function assertValidMaintenanceInfoPageSlug(slug) {
  const value = String(slug || '').trim();
  if (!MAINTENANCE_INFO_PAGE_SLUGS.includes(value)) {
    const err = new Error('Unknown maintenance info page');
    err.status = 404;
    throw err;
  }
  return value;
}

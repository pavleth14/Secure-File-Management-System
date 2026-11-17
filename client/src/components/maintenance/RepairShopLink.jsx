import { resolveRepairShopLink } from '../../utils/repairShopMaps';

export default function RepairShopLink({
  shop,
  mapsUrl,
  className = '',
  truncate = false,
}) {
  const label = String(shop || '').trim();
  if (!label) {
    return <span className={className}>—</span>;
  }

  const url = resolveRepairShopLink({ mapsUrl, shopName: label });
  if (!url) {
    return <span className={className}>{label}</span>;
  }

  const truncateClass = truncate ? 'block truncate' : '';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open “${label}” in Google Maps`}
      className={`text-brand-600 hover:underline dark:text-brand-400 ${truncateClass} ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
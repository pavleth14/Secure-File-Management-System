import {
  formatLeadPhoneDisplay,
  getLeadPhoneTelHref,
} from '../../utils/leadPhoneFormat';

export default function LeadPhoneCell({ phone, className = '' }) {
  const raw = String(phone || '').trim();
  if (!raw) {
    return <span className={className}>—</span>;
  }

  const display = formatLeadPhoneDisplay(raw);
  const href = getLeadPhoneTelHref(raw);

  if (!href) {
    return <span className={className}>{display}</span>;
  }

  return (
    <a
      href={href}
      className={`text-brand-700 hover:underline dark:text-brand-400 ${className}`.trim()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      {display}
    </a>
  );
}

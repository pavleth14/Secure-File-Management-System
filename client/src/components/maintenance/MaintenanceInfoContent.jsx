import { looksLikeHtml, sanitizeMaintenanceInfoHtml } from '../../utils/maintenanceInfoHtml';

const contentClass =
  'maintenance-info-content text-sm text-slate-800 dark:text-slate-200 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left dark:[&_td]:border-slate-600 dark:[&_th]:border-slate-600 dark:[&_th]:bg-slate-800/80';

export default function MaintenanceInfoContent({ content }) {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    return (
      <p className="text-sm italic text-slate-500 dark:text-slate-400">
        No content yet. Maintenance managers can add information with Edit.
      </p>
    );
  }

  if (looksLikeHtml(trimmed)) {
    const safeHtml = sanitizeMaintenanceInfoHtml(trimmed);
    return (
      <div className={contentClass} dangerouslySetInnerHTML={{ __html: safeHtml }} />
    );
  }

  return <div className={`whitespace-pre-wrap ${contentClass}`}>{trimmed}</div>;
}

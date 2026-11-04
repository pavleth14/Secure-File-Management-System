import { renderMaintenanceInfoContent } from '../../utils/maintenanceInfoMarkdown';

const proseClass = [
  'maintenance-info-prose max-w-none text-sm leading-relaxed text-slate-700 dark:text-slate-200',
  '[&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900 dark:[&_h1]:text-slate-50',
  '[&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-50',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 dark:[&_h3]:text-slate-100',
  '[&_p]:my-2.5 [&_p]:text-slate-700 dark:[&_p]:text-slate-300',
  '[&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100',
  '[&_a]:text-brand-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-700 dark:[&_a]:text-brand-400',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
  '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
  '[&_li]:text-slate-700 dark:[&_li]:text-slate-300',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-400/70 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 dark:[&_blockquote]:border-slate-500 [&_blockquote]:text-slate-400',
  '[&_hr]:my-6 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-600',
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:text-sm',
  '[&_thead]:bg-slate-100 dark:[&_thead]:bg-slate-800/90',
  '[&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-800 dark:[&_th]:border-slate-600 dark:[&_th]:text-slate-100',
  '[&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-700 dark:[&_td]:border-slate-600 dark:[&_td]:text-slate-300',
  '[&_tbody_tr:nth-child(even)]:bg-slate-50/80 dark:[&_tbody_tr:nth-child(even)]:bg-slate-900/40',
  '[&_img]:my-4 [&_img]:max-h-[min(80vh,48rem)] [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:shadow-sm dark:[&_img]:border-slate-600',
  '[&_.maintenance-callout]:my-4 [&_.maintenance-callout]:rounded-lg [&_.maintenance-callout]:border [&_.maintenance-callout]:px-4 [&_.maintenance-callout]:py-3 [&_.maintenance-callout]:text-sm',
  '[&_.maintenance-callout-info]:border-emerald-500/50 [&_.maintenance-callout-info]:bg-emerald-950/25 [&_.maintenance-callout-info]:text-emerald-50/95',
  '[&_.maintenance-callout-warning]:border-amber-500/50 [&_.maintenance-callout-warning]:bg-amber-950/20 [&_.maintenance-callout-warning]:text-amber-50/95',
  '[&_.maintenance-callout_p]:my-1 [&_.maintenance-callout_p]:text-inherit',
].join(' ');

export default function MaintenanceInfoContent({ content }) {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    return (
      <p className="text-sm italic text-slate-500 dark:text-slate-400">
        No content yet. Maintenance managers can add information with Edit.
      </p>
    );
  }

  const safeHtml = renderMaintenanceInfoContent(trimmed);
  return <div className={proseClass} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}

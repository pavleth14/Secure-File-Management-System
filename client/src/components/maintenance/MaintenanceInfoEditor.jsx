import { useRef, useState } from 'react';
import api from '../../api/client';

function buildSampleTemplate(pageTitle) {
  return `# ${pageTitle}

> Two Brothers Freight Inc. — centralized reference for Maintenance, Dispatch and Operations

:::info
**Security and accuracy** — Treat this page as internal operations reference. Verify phone numbers and addresses before sharing outside the company.
:::

## 1. Company at a glance

| Field | Information |
| --- | --- |
| Legal name | Two Brothers Freight Inc. |
| Main office | (your address) |
| Office phone | [(555) 555-0100](tel:+15555550100) |

## 2. Yards, parking and trailer rules

:::info
**Equipment rule** — Add your yard and parking rules here.
:::
`;
}

export default function MaintenanceInfoEditor({
  slug,
  pageTitle = 'Maintenance information',
  value,
  onChange,
  disabled = false,
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const insertAtCursor = (snippet) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${snippet}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(next);
    const cursor = start + snippet.length;
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post(`/maintenance/info-pages/${slug}/images`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const alt = file.name.replace(/\.[^.]+$/, '') || 'Image';
      insertAtCursor(`\n\n![${alt}](${data.url})\n\n`);
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        return;
      }
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {uploading ? 'Uploading…' : 'Insert image'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(buildSampleTemplate(pageTitle))}
          className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Load sample template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => uploadImage(event.target.files?.[0])}
        />
      </div>

      <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
          Formatting help (Markdown)
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <code># Title</code>, <code>## Section</code>, <code>**bold**</code>, lists, links{' '}
            <code>[text](url)</code>
          </li>
          <li>
            Tables: paste from Excel as CSV inside{' '}
            <code>{'```csv ... ```'}</code> or use <code>| col | col |</code> rows
          </li>
          <li>
            Green info box:{' '}
            <code>{':::info\nYour text\n:::'}</code>
          </li>
          <li>Subtitle quote: line starting with {`>`}</li>
          <li>Paste a screenshot with Ctrl+V, or use Insert image</li>
        </ul>
      </details>

      {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={handlePaste}
        disabled={disabled || uploading}
        className="min-h-[min(70vh,32rem)] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        spellCheck
      />
    </div>
  );
}

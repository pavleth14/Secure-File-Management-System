import { marked } from 'marked';
import { looksLikeHtml, sanitizeMaintenanceInfoHtml } from './maintenanceInfoHtml';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function csvToMarkdownTable(csvText) {
  const lines = csvText
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';

  const rows = lines.map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    return `| ${cells.join(' | ')} |`;
  });
  if (rows.length === 1) {
    const colCount = rows[0].split('|').filter((part) => part.trim()).length;
    const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
    return `${rows[0]}\n${separator}`;
  }
  const colCount = rows[0].split('|').filter((part) => part.trim()).length;
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
  return [rows[0], separator, ...rows.slice(1)].join('\n');
}

function preprocessCalloutsWithMarkdown(markdown) {
  return markdown.replace(
    /:::(info|warning)\s*\n([\s\S]*?)\n:::/gi,
    (_match, kind, body) => {
      const variant = String(kind).toLowerCase() === 'warning' ? 'warning' : 'info';
      const innerHtml = marked.parse(body.trim(), { async: false });
      return `<div class="maintenance-callout maintenance-callout-${variant}">${innerHtml}</div>\n\n`;
    }
  );
}

function preprocessCsvFences(markdown) {
  return markdown.replace(/```csv\s*\n([\s\S]*?)```/gi, (_match, csv) => {
    const table = csvToMarkdownTable(csv);
    return table ? `\n${table}\n` : '';
  });
}

export function renderMaintenanceInfoMarkdown(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return '';

  let md = preprocessCsvFences(trimmed);
  md = preprocessCalloutsWithMarkdown(md);
  const html = marked.parse(md, { async: false });
  return sanitizeMaintenanceInfoHtml(html);
}

export function renderMaintenanceInfoContent(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return '';

  if (looksLikeHtml(trimmed)) {
    return sanitizeMaintenanceInfoHtml(trimmed);
  }

  return renderMaintenanceInfoMarkdown(trimmed);
}

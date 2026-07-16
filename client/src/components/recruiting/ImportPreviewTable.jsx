import { formatDate } from '../../utils/format';

const PREVIEW_COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'driverType', label: 'Type of Driver' },
  { key: 'source', label: 'Source' },
  { key: 'date', label: 'Date' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'stateCity', label: 'State / City' },
  { key: 'email', label: 'Email' },
  { key: 'comments', label: 'Comments' },
];

export default function ImportPreviewTable({
  rows,
  selectedRows,
  onToggleRow,
  onToggleAll,
}) {
  const selectableRows = rows.filter((row) => row.isValid);
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedRows.has(row.rowNumber));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-3 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelectableSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                aria-label="Select all valid rows"
                className="rounded border-slate-300 dark:border-slate-600"
              />
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              Row
            </th>
            {PREVIEW_COLUMNS.map((column) => (
              <th
                key={column.key}
                className="px-3 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400"
              >
                {column.label}
              </th>
            ))}
            <th className="px-3 py-3 text-left text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
              Validation
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm text-slate-900 dark:divide-slate-700 dark:text-slate-100">
          {rows.map((row) => {
            const issues = [...(row.errors || []), ...(row.warnings || [])];
            const rowClass = !row.isValid
              ? 'bg-red-50/70 dark:bg-red-900/10'
              : row.isDuplicate
                ? 'bg-amber-50/70 dark:bg-amber-900/10'
                : '';

            return (
              <tr key={row.rowNumber} className={rowClass}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.rowNumber)}
                    disabled={!row.isValid}
                    onChange={() => onToggleRow(row.rowNumber)}
                    aria-label={`Select row ${row.rowNumber}`}
                    className="rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-medium">{row.rowNumber}</td>
                {PREVIEW_COLUMNS.map((column) => (
                  <td key={column.key} className="max-w-[12rem] truncate px-3 py-3">
                    {column.key === 'date'
                      ? row.date || (row.parsedCreatedAt ? formatDate(row.parsedCreatedAt) : 'Import date')
                      : row[column.key] || '—'}
                  </td>
                ))}
                <td className="min-w-[12rem] px-3 py-3">
                  {!issues.length ? (
                    <span className="text-green-700 dark:text-green-400">Ready to import</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {row.errors?.map((issue) => (
                        <li key={`error-${row.rowNumber}-${issue}`} className="text-red-700 dark:text-red-400">
                          {issue}
                        </li>
                      ))}
                      {row.warnings?.map((issue) => (
                        <li
                          key={`warning-${row.rowNumber}-${issue}`}
                          className="text-amber-700 dark:text-amber-400"
                        >
                          {issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

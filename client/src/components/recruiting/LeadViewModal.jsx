import { useEffect, useState } from 'react';
import api from '../../api/client';
import { formatDate } from '../../utils/format';
import { sortCommentsNewestFirst } from '../../utils/leadPermissions';

export default function LeadViewModal({ open, lead, onClose }) {
  const [fullLead, setFullLead] = useState(lead);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFullLead(lead);
  }, [lead]);

  useEffect(() => {
    if (!open || !lead?.id) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .get(`/recruiting/leads/${lead.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setFullLead(data.lead);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load lead details');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, lead?.id]);

  if (!open || !lead) return null;

  const displayLead = fullLead || lead;
  const comments = sortCommentsNewestFirst(displayLead.comments);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-view-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h2
            id="lead-view-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            {displayLead.firstName} {displayLead.lastName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Lead details</p>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">Loading lead...</p>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <>
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <DetailField label="Status" value={displayLead.status} />
              <DetailField label="Type of Driver" value={displayLead.driverType} />
              <DetailField label="Source" value={displayLead.source} />
              <DetailField label="Date" value={formatDate(displayLead.createdAt)} />
              <DetailField label="First Name" value={displayLead.firstName} />
              <DetailField label="Last Name" value={displayLead.lastName} />
              <DetailField label="Phone" value={displayLead.phone} />
              <DetailField label="Email" value={displayLead.email} />
              <DetailField
                label="State / City"
                value={displayLead.stateCity || '—'}
                className="sm:col-span-2"
              />
            </div>

            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Comments
              </h3>
              {comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <p className="text-sm text-slate-900 dark:text-slate-100">{comment.text}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {comment.author || 'Unknown'} · {formatDate(comment.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value || '—'}</dd>
    </div>
  );
}

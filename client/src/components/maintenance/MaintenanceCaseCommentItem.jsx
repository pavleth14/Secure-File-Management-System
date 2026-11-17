import { useEffect, useState } from 'react';
import TruncatedCommentText from '../recruiting/TruncatedCommentText';
import { formatDate } from '../../utils/format';

const editInputClass =
  'w-full resize-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function MaintenanceCaseCommentItem({
  comment,
  currentUserId,
  onSave,
  compact = false,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit =
    Boolean(onSave) &&
    Boolean(currentUserId) &&
    String(comment.authorId) === String(currentUserId);

  useEffect(() => {
    if (!editing) {
      setDraft(comment.text);
    }
  }, [comment.text, comment.id, editing]);

  const cancelEdit = () => {
    setDraft(comment.text);
    setEditing(false);
    setError('');
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Comment cannot be empty');
      return;
    }
    if (trimmed === comment.text) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save comment');
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
        {editing ? (
          <div>
            <textarea
              className={editInputClass}
              rows={3}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelEdit}
                className="text-xs text-slate-500 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <TruncatedCommentText text={comment.text} />
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {comment.author || 'Unknown'} · {formatDate(comment.createdAt)}
                {comment.updatedAt &&
                comment.createdAt &&
                new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime()
                  ? ' · edited'
                  : ''}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  Edit
                </button>
              )}
            </div>
          </>
        )}
      </li>
    );
  }

  return (
    <li className="text-sm">
      {editing ? (
        <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          <textarea
            className={editInputClass}
            rows={3}
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={saveEdit}
              className="rounded bg-brand-600 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelEdit}
              className="rounded border px-2 py-1 text-xs dark:border-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{comment.author}</span>
            <span className="text-xs text-slate-500">
              {new Date(comment.createdAt).toLocaleString()}
              {comment.updatedAt &&
              comment.createdAt &&
              new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime()
                ? ' (edited)'
                : ''}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{comment.text}</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
            >
              Edit
            </button>
          )}
        </>
      )}
    </li>
  );
}
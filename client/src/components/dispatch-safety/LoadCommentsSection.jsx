import { useState } from 'react';
import api from '../../api/client';
import { formatDate } from '../../utils/format';

function CommentItem({ comment, onEditComment }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === comment.text) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onEditComment(comment.id, trimmed);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update comment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white"
            >
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(comment.text);
                setEditing(false);
              }}
              className="rounded border px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-900 dark:text-slate-100">{comment.text}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {comment.author} · {formatDate(comment.createdAt)}
            </p>
            {comment.canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
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

export default function LoadCommentsSection({ loadId, comments, onCommentsChange }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/dispatch/loads/${loadId}/comments`, { text: trimmed });
      onCommentsChange(data.load.comments || []);
      setText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId, newText) => {
    const { data } = await api.put(`/dispatch/loads/${loadId}/comments/${commentId}`, {
      text: newText,
    });
    onCommentsChange(data.load.comments || []);
  };

  const sortedComments = [...comments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
      <form onSubmit={handleAdd} className="mb-4 space-y-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="Add a comment..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add comment'}
        </button>
      </form>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {sortedComments.length === 0 ? (
          <li className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</li>
        ) : (
          sortedComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} onEditComment={handleEdit} />
          ))
        )}
      </ul>
    </div>
  );
}

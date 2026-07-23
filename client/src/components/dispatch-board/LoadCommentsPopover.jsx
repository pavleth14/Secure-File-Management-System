import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
            <button type="button" disabled={saving} onClick={handleSave} className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white">
              Save
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-xs">
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

export default function LoadCommentsPopover({ loadId, anchorRect, open, onClose }) {
  const popoverRef = useRef(null);
  const scrollListRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 });
  const [load, setLoad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !loadId) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .get(`/dispatch/loads/${loadId}`)
      .then(({ data }) => {
        if (!cancelled) setLoad(data.load);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Failed to load comments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loadId]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;

    const padding = 8;
    const width = 320;
    let top = anchorRect.bottom + 6;
    let left = anchorRect.left;

    if (left + width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - width - padding);
    }
    if (top + 320 > window.innerHeight - padding) {
      top = Math.max(padding, anchorRect.top - 326);
    }

    setPosition({ top, left, width });
  }, [open, anchorRect]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      onClose();
    };

    const handleScroll = (event) => {
      if (scrollListRef.current?.contains(event.target)) return;
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') onClose();
    });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose]);

  if (!open || !loadId) return null;

  const handleAdd = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/dispatch/loads/${loadId}/comments`, { text: trimmed });
      setLoad(data.load);
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
    setLoad(data.load);
  };

  const comments = [...(load?.comments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[70] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Load #{load?.loadNumber || '...'} comments
        </h3>
      </div>

      <div className="max-h-80 overflow-y-auto px-4 py-3" ref={scrollListRef}>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <>
            {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <form onSubmit={handleAdd} className="mb-3 space-y-2">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                placeholder="Add a comment..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add comment'}
              </button>
            </form>
            <ul className="space-y-2">
              {comments.length === 0 ? (
                <li className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</li>
              ) : (
                comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} onEditComment={handleEdit} />
                ))
              )}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { formatDate } from '../../utils/format';
import {
  canEditComment,
  getLatestComment,
  sortCommentsNewestFirst,
} from '../../utils/leadPermissions';

function CommentItem({ comment, currentUserId, onEditComment, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editable = !readOnly && onEditComment && canEditComment(comment, currentUserId);

  useEffect(() => {
    setDraft(comment.text);
    setEditing(false);
    setError('');
  }, [comment.id, comment.text]);

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
      setError(err.response?.data?.message || err.message || 'Failed to update comment');
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
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(comment.text);
                setEditing(false);
                setError('');
              }}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
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
              {comment.author || 'Unknown'} · {formatDate(comment.createdAt)}
            </p>
            {editable && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
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

export default function LeadCommentsCell({
  lead,
  open,
  onToggle,
  onClose,
  currentUserId,
  onEditComment,
  readOnly = false,
}) {
  const cellRef = useRef(null);
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [comments, setComments] = useState(lead.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState('');

  const latestComment = getLatestComment(lead.comments);
  const sortedComments = sortCommentsNewestFirst(comments);

  useEffect(() => {
    setComments(lead.comments || []);
  }, [lead.comments, lead.id]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoadingComments(true);
    setCommentsError('');

    api
      .get(`/recruiting/leads/${lead.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setComments(data.lead?.comments || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCommentsError(err.response?.data?.message || 'Failed to load comments');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingComments(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, lead.id]);

  useLayoutEffect(() => {
    if (!open || !cellRef.current) return;

    const rect = cellRef.current.getBoundingClientRect();
    const padding = 8;
    let top = rect.bottom + 4;
    let left = rect.left;
    const width = Math.max(rect.width, 280);

    if (left + width > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - width - padding);
    }

    setPosition({ top, left, width });
  }, [open, lead.id]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        cellRef.current?.contains(event.target) ||
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  const handleEditComment = async (commentId, text) => {
    if (!onEditComment) return;
    const updatedLead = await onEditComment(lead.id, commentId, text);
    setComments(updatedLead?.comments || []);
  };

  return (
    <>
      <td
        ref={cellRef}
        className="max-w-[14rem] cursor-pointer px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(lead.id);
        }}
        title={latestComment ? 'View comment history' : 'No comments yet'}
      >
        <span className="line-clamp-2">
          {latestComment?.text || <span className="text-slate-400 dark:text-slate-500">—</span>}
        </span>
      </td>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[65] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Comment history
              </p>
            </div>
            <div
              className="max-h-72 overflow-y-auto px-3 py-2"
              style={{ scrollbarGutter: 'stable' }}
            >
              {loadingComments ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Loading comments...</p>
              ) : commentsError ? (
                <p className="py-2 text-sm text-red-600 dark:text-red-400">{commentsError}</p>
              ) : sortedComments.length === 0 ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedComments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={currentUserId}
                      onEditComment={onEditComment}
                      readOnly={readOnly}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

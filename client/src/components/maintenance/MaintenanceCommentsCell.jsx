import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { formatDate } from '../../utils/format';
import TruncatedCommentText from '../recruiting/TruncatedCommentText';

function CommentItem({ comment }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
      <TruncatedCommentText text={comment.text} />
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {comment.author || 'Unknown'} · {formatDate(comment.createdAt)}
      </p>
    </li>
  );
}

const VIEWPORT_PADDING = 8;
const POPOVER_GAP = 4;
const MIN_POPOVER_WIDTH = 280;

function computePopoverPosition(cellEl, popoverEl, hasInput = true) {
  const rect = cellEl.getBoundingClientRect();
  const popoverHeight = popoverEl?.offsetHeight ?? 360;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const width = Math.max(rect.width, MIN_POPOVER_WIDTH);
  let left = rect.left;
  if (left + width > viewportWidth - VIEWPORT_PADDING) {
    left = Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING);
  }

  const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
  const spaceAbove = rect.top - VIEWPORT_PADDING;
  const openBelow = spaceBelow >= popoverHeight || spaceBelow >= spaceAbove;

  let top = openBelow ? rect.bottom + POPOVER_GAP : rect.top - popoverHeight - POPOVER_GAP;

  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, viewportHeight - popoverHeight - VIEWPORT_PADDING)
  );

  const chromeEstimate = popoverEl
    ? popoverEl.offsetHeight - (popoverEl.querySelector('[data-comment-list]')?.offsetHeight ?? 0)
    : hasInput
      ? 140
      : 44;
  const listMaxHeight = Math.min(
    288,
    Math.max(120, viewportHeight - top - VIEWPORT_PADDING - chromeEstimate)
  );

  return { top, left, width, listMaxHeight };
}

export default function MaintenanceCommentsCell({
  maintenanceCase,
  open,
  onToggle,
  onClose,
  onSubmitComment,
  readOnly = false,
}) {
  const cellRef = useRef(null);
  const popoverRef = useRef(null);
  const scrollListRef = useRef(null);
  const newCommentRef = useRef(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: MIN_POPOVER_WIDTH,
    listMaxHeight: 288,
  });
  const [comments, setComments] = useState(maintenanceCase.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [addCommentError, setAddCommentError] = useState('');

  const canAddComment = !readOnly && Boolean(onSubmitComment);
  const preview = maintenanceCase.latestCommentPreview || comments[0]?.text;

  useEffect(() => {
    setComments(maintenanceCase.comments || []);
  }, [maintenanceCase.comments, maintenanceCase.id]);

  useEffect(() => {
    if (!open) {
      setNewCommentText('');
      setAddCommentError('');
      setSubmittingComment(false);
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      newCommentRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open, maintenanceCase.id]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoadingComments(true);
    setCommentsError('');

    api
      .get(`/maintenance/cases/${maintenanceCase.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setComments(data.case?.comments || []);
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
  }, [open, maintenanceCase.id]);

  const updatePosition = useCallback(() => {
    if (!cellRef.current || !open) return;
    setPosition(computePopoverPosition(cellRef.current, popoverRef.current, canAddComment));
  }, [open, canAddComment]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);

    return () => window.cancelAnimationFrame(raf);
  }, [open, updatePosition, loadingComments, comments.length, canAddComment]);

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

    const handleScroll = (event) => {
      const target = event.target;
      if (
        popoverRef.current?.contains(target) ||
        scrollListRef.current?.contains(target) ||
        target === scrollListRef.current
      ) {
        return;
      }

      updatePosition();

      if (!cellRef.current) return;
      const rect = cellRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, onClose, updatePosition]);

  const handleSubmitNewComment = async () => {
    if (!onSubmitComment || submittingComment) return;

    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    setSubmittingComment(true);
    setAddCommentError('');
    try {
      const updatedCase = await onSubmitComment(trimmed);
      setComments(updatedCase?.comments || []);
      setNewCommentText('');
      newCommentRef.current?.focus();
    } catch (err) {
      setAddCommentError(err.response?.data?.message || err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleNewCommentKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmitNewComment();
    }
  };

  return (
    <>
      <td
        ref={cellRef}
        className="max-w-[14rem] cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(maintenanceCase.id);
        }}
        title={preview ? 'View comment history' : 'No comments yet'}
      >
        <span className="line-clamp-2">
          {preview || <span className="text-slate-400 dark:text-slate-500">—</span>}
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
            {canAddComment && (
              <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <textarea
                  ref={newCommentRef}
                  value={newCommentText}
                  onChange={(event) => setNewCommentText(event.target.value)}
                  onKeyDown={handleNewCommentKeyDown}
                  rows={2}
                  disabled={submittingComment}
                  placeholder="Add a comment…"
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Enter to save · Shift+Enter for new line
                  </p>
                  {submittingComment && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Saving…</span>
                  )}
                </div>
                {addCommentError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{addCommentError}</p>
                )}
              </div>
            )}
            <div
              ref={scrollListRef}
              data-comment-list
              className="overflow-y-auto overscroll-y-contain px-3 py-2"
              style={{
                maxHeight: position.listMaxHeight,
                scrollbarGutter: 'stable',
                WebkitOverflowScrolling: 'touch',
              }}
              onWheel={(event) => event.stopPropagation()}
            >
              {loadingComments ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Loading comments...</p>
              ) : commentsError ? (
                <p className="py-2 text-sm text-red-600 dark:text-red-400">{commentsError}</p>
              ) : comments.length === 0 ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
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

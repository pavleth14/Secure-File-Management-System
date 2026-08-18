import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { formatDate } from '../../utils/format';
import {
  getLatestRingCentralEvent,
  sortRingCentralEventsNewestFirst,
} from '../../utils/ringCentralEvents';
import TruncatedCommentText from './TruncatedCommentText';

const VIEWPORT_PADDING = 8;
const POPOVER_GAP = 4;
const MIN_POPOVER_WIDTH = 280;

function computePopoverPosition(cellEl, popoverEl) {
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
    ? popoverEl.offsetHeight - (popoverEl.querySelector('[data-rc-event-list]')?.offsetHeight ?? 0)
    : 44;
  const listMaxHeight = Math.min(
    288,
    Math.max(120, viewportHeight - top - VIEWPORT_PADDING - chromeEstimate)
  );

  return { top, left, width, listMaxHeight };
}

function RingCentralEventItem({ event }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50">
      <TruncatedCommentText text={event.text} />
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {event.author || 'Unknown'} · {formatDate(event.occurredAt || event.createdAt)}
          {event.isSystem && (
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              System
            </span>
          )}
        </p>
      </div>
    </li>
  );
}

export default function LeadRingCentralCell({ lead, open, onToggle, onClose }) {
  const cellRef = useRef(null);
  const popoverRef = useRef(null);
  const scrollListRef = useRef(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: MIN_POPOVER_WIDTH,
    listMaxHeight: 288,
  });
  const [events, setEvents] = useState(lead.ringCentralEvents || []);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const latestEvent = getLatestRingCentralEvent(lead.ringCentralEvents);
  const sortedEvents = sortRingCentralEventsNewestFirst(events);

  useEffect(() => {
    setEvents(lead.ringCentralEvents || []);
  }, [lead.ringCentralEvents, lead.id]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoadingEvents(true);
    setEventsError('');

    api
      .get(`/recruiting/leads/${lead.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setEvents(data.lead?.ringCentralEvents || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEventsError(err.response?.data?.message || 'Failed to load RingCentral history');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, lead.id]);

  const updatePosition = useCallback(() => {
    if (!cellRef.current || !open) return;
    setPosition(computePopoverPosition(cellRef.current, popoverRef.current));
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);

    return () => window.cancelAnimationFrame(raf);
  }, [open, updatePosition, loadingEvents, events.length]);

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

  return (
    <>
      <td
        ref={cellRef}
        className="max-w-[14rem] cursor-pointer px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(lead.id);
        }}
        title={latestEvent ? 'View RingCentral history' : 'No RingCentral activity yet'}
      >
        <span className="line-clamp-2">
          {latestEvent?.text || <span className="text-slate-400 dark:text-slate-500">—</span>}
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
                RingCentral history
              </p>
            </div>
            <div
              ref={scrollListRef}
              data-rc-event-list
              className="overflow-y-auto overscroll-y-contain px-3 py-2"
              style={{
                maxHeight: position.listMaxHeight,
                scrollbarGutter: 'stable',
                WebkitOverflowScrolling: 'touch',
              }}
              onWheel={(event) => event.stopPropagation()}
            >
              {loadingEvents ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">Loading...</p>
              ) : eventsError ? (
                <p className="py-2 text-sm text-red-600 dark:text-red-400">{eventsError}</p>
              ) : sortedEvents.length === 0 ? (
                <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
                  No RingCentral activity yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sortedEvents.map((event) => (
                    <RingCentralEventItem key={event.id} event={event} />
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

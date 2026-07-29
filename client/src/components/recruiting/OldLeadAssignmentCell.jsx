import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from '../../utils/format';

export default function OldLeadAssignmentCell({ oldLead, open, onToggle, onClose }) {
  const cellRef = useRef(null);
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });

  const assignment = oldLead?.assignment;
  const hasAssignment = Boolean(assignment?.recruiterName);

  useLayoutEffect(() => {
    if (!open || !cellRef.current) return;

    const rect = cellRef.current.getBoundingClientRect();
    const width = 280;
    let top = rect.bottom + 6;
    let left = rect.left;

    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    if (top + 180 > window.innerHeight - 8) {
      top = Math.max(8, rect.top - 186);
    }

    setPosition({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target) || cellRef.current?.contains(event.target)) {
        return;
      }
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') onClose();
    });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, onClose]);

  return (
    <>
      <td ref={cellRef} className="whitespace-nowrap px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => onToggle(oldLead.id)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            hasAssignment
              ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }`}
        >
          {hasAssignment ? 'Assigned' : 'Unassigned'}
        </button>
      </td>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[70] rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Assignment history
              </h3>
            </div>
            <div className="max-h-48 overflow-y-auto px-4 py-3">
              {!hasAssignment ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Not assigned yet.</p>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {assignment.recruiterName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(assignment.assignedAt)}
                    {assignment.assignedByName ? ` · by ${assignment.assignedByName}` : ''}
                  </p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

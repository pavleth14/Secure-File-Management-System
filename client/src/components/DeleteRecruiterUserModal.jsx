export default function DeleteRecruiterUserModal({
  open,
  userName,
  preview,
  previewLoading,
  submitting,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const isRecruiterMigration = preview?.isRecruiter && preview?.appliesLeadMigration;
  const canDelete = preview?.canDelete !== false;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-recruiter-user-title"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="delete-recruiter-user-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Delete user?
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {userName}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-slate-700 dark:text-slate-300">
          {previewLoading && (
            <p className="text-slate-500 dark:text-slate-400">Loading lead summary…</p>
          )}

          {!previewLoading && isRecruiterMigration && (
            <>
              <p>
                This recruiter has <strong>{preview.boardLeadCount}</strong> lead
                {preview.boardLeadCount !== 1 ? 's' : ''} on their active board. Before the
                account is removed:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>{preview.activeStatusBoardCount}</strong> lead
                  {preview.activeStatusBoardCount !== 1 ? 's' : ''} with an{' '}
                  <strong>Active</strong> status will be{' '}
                  <strong>round-robin assigned</strong> to other recruiters (same rules as new
                  lead import, by driver type).
                </li>
                <li>
                  <strong>{preview.nonActiveStatusBoardCount}</strong> lead
                  {preview.nonActiveStatusBoardCount !== 1 ? 's' : ''} with a{' '}
                  <strong>Non-active</strong> status will be moved to{' '}
                  <strong>Archive</strong>.
                </li>
              </ul>
              <p className="text-slate-500 dark:text-slate-400">
                Archived leads stay assigned to this recruiter until restored or reassigned from
                the Archive page.
              </p>
            </>
          )}

          {!previewLoading && preview?.isRecruiter && !preview?.appliesLeadMigration && (
            <p>
              This recruiter has no active board leads. The account will be deleted with no lead
              migration.
            </p>
          )}

          {!previewLoading && preview && !preview.isRecruiter && (
            <p>This user is not a recruiter. The account will be deleted permanently.</p>
          )}

          {!previewLoading && !canDelete && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-red-800 dark:bg-red-900/30 dark:text-red-300">
              {preview.blockReason ||
                'This user cannot be deleted until another recruiter is available.'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            No, cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={previewLoading || submitting || !canDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Deleting…' : 'Yes, delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}

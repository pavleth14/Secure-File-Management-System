export default function AddCommentModal({ open, lead, onConfirm, onCancel, submitting = false }) {
  if (!open || !lead) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get('text');
    if (!String(text || '').trim()) return;
    onConfirm(String(text).trim());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-comment-title"
    >
      <form
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id="add-comment-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Add comment
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {lead.firstName} {lead.lastName}
          </p>
        </div>
        <div className="px-5 py-4">
          <label htmlFor="comment-text" className="sr-only">
            Comment
          </label>
          <textarea
            id="comment-text"
            name="text"
            rows={4}
            required
            autoFocus
            placeholder="Enter your comment..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Add comment'}
          </button>
        </div>
      </form>
    </div>
  );
}

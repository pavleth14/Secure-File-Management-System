import { useUpload } from '../context/UploadContext';
import { formatSize } from '../utils/format';
import {
  CheckIcon,
  AlertIcon,
  CloseIcon,
  RetryIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  SpinnerIcon,
  FileIcon,
} from './icons';

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  return `${formatSize(Math.round(bytesPerSec))}/s`;
}

function formatEta(seconds) {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s left`;
}

function UploadRow({ item }) {
  const { STATUS, cancelUpload, retryUpload, removeUpload } = useUpload();

  const statusColor =
    item.status === STATUS.SUCCESS
      ? 'bg-green-500'
      : item.status === STATUS.ERROR
      ? 'bg-red-500'
      : item.status === STATUS.CANCELED
      ? 'bg-slate-400'
      : 'bg-brand-500';

  const isActive = item.status === STATUS.UPLOADING || item.status === STATUS.QUEUED;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-slate-400 dark:text-slate-500">
          {item.status === STATUS.SUCCESS ? (
            <CheckIcon className="text-green-500" />
          ) : item.status === STATUS.ERROR ? (
            <AlertIcon className="text-red-500" />
          ) : item.status === STATUS.UPLOADING ? (
            <SpinnerIcon className="text-brand-500" />
          ) : (
            <FileIcon />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {item.name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {item.status === STATUS.ERROR ? (
              <span className="text-red-500 dark:text-red-400">{item.error}</span>
            ) : item.status === STATUS.CANCELED ? (
              'Canceled'
            ) : item.status === STATUS.SUCCESS ? (
              `${formatSize(item.size)} · Completed`
            ) : item.status === STATUS.QUEUED ? (
              `${formatSize(item.size)} · Queued`
            ) : (
              <>
                {item.progress}% · {formatSize(item.size)}
                {formatSpeed(item.speed) && ` · ${formatSpeed(item.speed)}`}
                {formatEta(item.eta) && ` · ${formatEta(item.eta)}`}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isActive && (
            <button
              type="button"
              onClick={() => cancelUpload(item.id)}
              title="Cancel"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-700"
            >
              <CloseIcon />
            </button>
          )}
          {(item.status === STATUS.ERROR || item.status === STATUS.CANCELED) &&
            item.size <= 50 * 1024 * 1024 && (
              <button
                type="button"
                onClick={() => retryUpload(item.id)}
                title="Retry"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-700"
              >
                <RetryIcon />
              </button>
            )}
          {!isActive && (
            <button
              type="button"
              onClick={() => removeUpload(item.id)}
              title="Dismiss"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {(item.status === STATUS.UPLOADING || item.status === STATUS.QUEUED) && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-200 ${statusColor}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function UploadManager() {
  const {
    uploads,
    activeCount,
    minimized,
    setMinimized,
    cancelAll,
    clearFinished,
    STATUS,
  } = useUpload();

  if (uploads.length === 0) return null;

  const doneCount = uploads.filter(
    (u) =>
      u.status === STATUS.SUCCESS ||
      u.status === STATUS.ERROR ||
      u.status === STATUS.CANCELED
  ).length;

  const headerLabel =
    activeCount > 0
      ? `Uploading ${activeCount} item${activeCount > 1 ? 's' : ''}`
      : `${doneCount} upload${doneCount > 1 ? 's' : ''} complete`;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,24rem)]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2 bg-slate-800 px-4 py-3 text-white dark:bg-slate-900">
          <p className="truncate text-sm font-medium">{headerLabel}</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimized(!minimized)}
              title={minimized ? 'Expand' : 'Minimize'}
              className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {minimized ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            <button
              type="button"
              onClick={() => {
                cancelAll();
                clearFinished();
              }}
              title="Close"
              className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
            {uploads.map((item) => (
              <UploadRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

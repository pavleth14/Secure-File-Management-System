import { PROCESSING_STEPS } from '../../constants/recruitingConstants';
import { canSelectProcessingStep, getProcessingStepIndex } from '../../utils/processingSteps';
import { formatChicagoSavedAt, formatDurationMs } from '../../utils/recruitingAnalytics';

function buildLatestSaveMap(stepHistory) {
  const map = {};
  for (const entry of stepHistory || []) {
    const existing = map[entry.stepKey];
    if (!existing || new Date(entry.savedAt) > new Date(existing.savedAt)) {
      map[entry.stepKey] = entry;
    }
  }
  return map;
}

function buildSortedHistory(stepHistory) {
  return [...(stepHistory || [])].sort(
    (a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
  );
}

function findPreviousSave(sortedHistory, savedAt) {
  const targetTime = new Date(savedAt).getTime();
  let previous = null;
  for (const entry of sortedHistory) {
    const entryTime = new Date(entry.savedAt).getTime();
    if (entryTime < targetTime) {
      previous = entry;
    } else {
      break;
    }
  }
  return previous;
}

export default function ProcessingProgressBar({
  value,
  onChange,
  readOnly = false,
  stepHistory = [],
}) {
  const currentIndex = getProcessingStepIndex(value);
  const latestSaveByStep = buildLatestSaveMap(stepHistory);
  const sortedHistory = buildSortedHistory(stepHistory);

  const handleStepClick = (stepKey) => {
    if (readOnly || !onChange) return;
    if (!canSelectProcessingStep(value, stepKey)) return;
    onChange(stepKey);
  };

  return (
    <div className="mt-3 overflow-x-auto pb-1">
      <div className="relative min-w-[720px] px-2 pt-2">
        <div
          className="absolute left-6 right-6 top-[3.75rem] h-0.5 bg-slate-200 dark:bg-slate-600"
          aria-hidden
        />
        <div
          className="absolute left-6 top-[3.75rem] h-0.5 bg-brand-500 transition-all duration-300 dark:bg-brand-400"
          style={{
            width:
              currentIndex >= 0
                ? `calc((100% - 3rem) * ${currentIndex / (PROCESSING_STEPS.length - 1)})`
                : '0%',
          }}
          aria-hidden
        />

        <ol className="relative flex justify-between gap-1">
          {PROCESSING_STEPS.map((step, index) => {
            const isComplete = currentIndex >= 0 && index <= currentIndex;
            const isCurrent = index === currentIndex;
            const isSelectable =
              !readOnly && onChange && canSelectProcessingStep(value, step.key);
            const savedEntry = latestSaveByStep[step.key];
            const previousSave = savedEntry
              ? findPreviousSave(sortedHistory, savedEntry.savedAt)
              : null;
            const durationMs = savedEntry && previousSave
              ? new Date(savedEntry.savedAt).getTime() - new Date(previousSave.savedAt).getTime()
              : null;

            return (
              <li
                key={step.key}
                className="flex w-[88px] flex-col items-center text-center"
              >
                <div className="mb-2 min-h-[2.75rem] w-full px-0.5">
                  {savedEntry ? (
                    <div className="text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                      <p className="font-medium text-slate-600 dark:text-slate-300">
                        Step: {step.label}
                      </p>
                      <p>Saved: {formatChicagoSavedAt(savedEntry.savedAt)}</p>
                      {durationMs != null && durationMs >= 0 && (
                        <p className="mt-0.5 text-brand-600 dark:text-brand-400">
                          +{formatDurationMs(durationMs)} from previous
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="invisible text-[9px]">—</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleStepClick(step.key)}
                  disabled={!isSelectable}
                  title={step.label}
                  aria-label={step.label}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                    isComplete
                      ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-500'
                      : 'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500'
                  } ${
                    isCurrent
                      ? 'ring-2 ring-brand-200 ring-offset-2 dark:ring-brand-900 dark:ring-offset-slate-800'
                      : ''
                  } ${
                    isSelectable
                      ? 'cursor-pointer hover:border-brand-500 hover:text-brand-600 dark:hover:border-brand-400'
                      : readOnly
                        ? 'cursor-default'
                        : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  {index + 1}
                </button>
                <span
                  className={`mt-2 line-clamp-3 text-[10px] leading-tight ${
                    isComplete
                      ? 'font-medium text-slate-800 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

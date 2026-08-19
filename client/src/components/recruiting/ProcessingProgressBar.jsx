import { PROCESSING_STEPS } from '../../constants/recruitingConstants';
import { canSelectProcessingStep, getProcessingStepIndex } from '../../utils/processingSteps';
import { formatChicagoSavedAt, formatDurationMs } from '../../utils/recruitingAnalytics';

const STEP_COLUMN_WIDTH = '7.25rem';

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

  const progressWidth =
    currentIndex >= 0
      ? `calc((100% - 3rem) * ${currentIndex / (PROCESSING_STEPS.length - 1)})`
      : '0%';

  return (
    <div className="mt-3 overflow-x-auto pb-1">
      <div className="relative min-w-[920px] px-1">
        {/* Row 1: saved timestamps — fixed height so circles stay aligned below */}
        <div className="flex justify-between">
          {PROCESSING_STEPS.map((step) => {
            const savedEntry = latestSaveByStep[step.key];
            const previousSave = savedEntry
              ? findPreviousSave(sortedHistory, savedEntry.savedAt)
              : null;
            const durationMs =
              savedEntry && previousSave
                ? new Date(savedEntry.savedAt).getTime() -
                  new Date(previousSave.savedAt).getTime()
                : null;

            return (
              <div
                key={`saved-${step.key}`}
                className="flex h-16 flex-shrink-0 flex-col items-center justify-end px-0.5 text-center"
                style={{ width: STEP_COLUMN_WIDTH }}
              >
                {savedEntry ? (
                  <div className="w-full space-y-0.5 text-[9px] leading-snug text-slate-500 dark:text-slate-400">
                    <p
                      className="truncate font-medium text-slate-600 dark:text-slate-300"
                      title={step.label}
                    >
                      Step: {step.label}
                    </p>
                    <p className="truncate" title={formatChicagoSavedAt(savedEntry.savedAt)}>
                      Saved: {formatChicagoSavedAt(savedEntry.savedAt)}
                    </p>
                    {durationMs != null && durationMs >= 0 && (
                      <p className="truncate text-brand-600 dark:text-brand-400">
                        +{formatDurationMs(durationMs)} from previous
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="invisible block h-4" aria-hidden>
                    —
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Row 2: circles + progress line — single horizontal track */}
        <div className="relative mt-1 flex h-10 items-center justify-between">
          <div
            className="pointer-events-none absolute left-6 right-6 top-1/2 h-0.5 -translate-y-1/2 bg-slate-200 dark:bg-slate-600"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-6 top-1/2 h-0.5 -translate-y-1/2 bg-brand-500 transition-all duration-300 dark:bg-brand-400"
            style={{ width: progressWidth }}
            aria-hidden
          />

          {PROCESSING_STEPS.map((step, index) => {
            const isComplete = currentIndex >= 0 && index <= currentIndex;
            const isCurrent = index === currentIndex;
            const isSelectable =
              !readOnly && onChange && canSelectProcessingStep(value, step.key);

            return (
              <div
                key={`circle-${step.key}`}
                className="relative z-10 flex flex-shrink-0 justify-center"
                style={{ width: STEP_COLUMN_WIDTH }}
              >
                <button
                  type="button"
                  onClick={() => handleStepClick(step.key)}
                  disabled={!isSelectable}
                  title={step.label}
                  aria-label={step.label}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
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
              </div>
            );
          })}
        </div>

        {/* Row 3: step labels — one line, aligned */}
        <div className="mt-1.5 flex justify-between">
          {PROCESSING_STEPS.map((step, index) => {
            const isComplete = currentIndex >= 0 && index <= currentIndex;

            return (
              <div
                key={`label-${step.key}`}
                className="flex-shrink-0 px-0.5 text-center"
                style={{ width: STEP_COLUMN_WIDTH }}
              >
                <span
                  className={`block truncate text-[10px] leading-tight ${
                    isComplete
                      ? 'font-medium text-slate-800 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title={step.label}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

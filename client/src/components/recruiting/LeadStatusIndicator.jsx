import { DEFAULT_STATUS_COLOR } from '../../utils/leadStatusColors';
import { getProcessingStepDisplayNumber } from '../../utils/processingSteps';

export default function LeadStatusIndicator({
  statusName,
  processingStep = null,
  statusColorMap = {},
}) {
  if (!statusName) {
    return <span className="text-slate-400">—</span>;
  }

  const color = statusColorMap[statusName] || DEFAULT_STATUS_COLOR;

  if (statusName === 'Processing') {
    const stepNumber = getProcessingStepDisplayNumber(processingStep);

    return (
      <span className="inline-flex flex-col items-start leading-tight">
        <span className="-mb-0.5 inline-flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span>{statusName}</span>
        </span>
        <span className="pl-[1.125rem] text-xs text-slate-500 dark:text-slate-400">
          Step {stepNumber}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>{statusName}</span>
    </span>
  );
}

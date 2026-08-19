import {
  PROCESSING_STEP_KEYS,
  PROCESSING_STEP_HIRED_KEY,
} from '../constants/recruitingConstants';

export function getProcessingStepIndex(stepKey) {
  if (!stepKey) return -1;
  return PROCESSING_STEP_KEYS.indexOf(stepKey);
}

/** Step 0 = no step selected; Step 1–8 = processing step keys. */
export function getProcessingStepDisplayNumber(stepKey) {
  if (!stepKey) return 0;
  const stepIndex = PROCESSING_STEP_KEYS.indexOf(stepKey);
  if (stepIndex === -1) return 0;
  return stepIndex + 1;
}

export function canSelectProcessingStep(currentStepKey, targetStepKey) {
  const currentIndex = getProcessingStepIndex(currentStepKey);
  const targetIndex = getProcessingStepIndex(targetStepKey);

  if (targetIndex === -1) return false;
  if (targetIndex <= currentIndex) return true;
  return targetIndex > currentIndex;
}

export function getProcessingStepLabel(stepKey, steps) {
  const match = steps.find((step) => step.key === stepKey);
  return match?.label || stepKey || '—';
}

/** Resolve the current processing step key from lead API data (matches board display). */
export function resolveLeadProcessingStep(lead) {
  if (!lead) return null;

  if (lead.processingStep) {
    return lead.processingStep;
  }

  if (lead.processingStepIndex != null && lead.processingStepIndex > 0) {
    const stepKey = PROCESSING_STEP_KEYS[lead.processingStepIndex - 1];
    if (stepKey) return stepKey;
  }

  const history = lead.processingStepHistory;
  if (Array.isArray(history) && history.length > 0) {
    const latest = [...history].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    )[0];
    return latest?.stepKey || null;
  }

  return null;
}

export { PROCESSING_STEP_HIRED_KEY, PROCESSING_STEP_KEYS };

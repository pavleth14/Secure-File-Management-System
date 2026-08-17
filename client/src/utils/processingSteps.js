import {
  PROCESSING_STEP_KEYS,
  PROCESSING_STEP_HIRED_KEY,
} from '../constants/recruitingConstants';

export function getProcessingStepIndex(stepKey) {
  if (!stepKey) return -1;
  return PROCESSING_STEP_KEYS.indexOf(stepKey);
}

export function canSelectProcessingStep(currentStepKey, targetStepKey) {
  const currentIndex = getProcessingStepIndex(currentStepKey);
  const targetIndex = getProcessingStepIndex(targetStepKey);

  if (targetIndex === -1) return false;
  if (targetIndex <= currentIndex) return true;
  return targetIndex === currentIndex + 1;
}

export function getProcessingStepLabel(stepKey, steps) {
  const match = steps.find((step) => step.key === stepKey);
  return match?.label || stepKey || '—';
}

export { PROCESSING_STEP_HIRED_KEY, PROCESSING_STEP_KEYS };

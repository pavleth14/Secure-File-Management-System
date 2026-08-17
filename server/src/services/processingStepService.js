import {
  PROCESSING_STEPS,
  PROCESSING_STEP_KEYS,
  PROCESSING_STEP_HIRED_KEY,
} from '../config/recruitingConstants.js';

export function getProcessingStepLabel(stepKey) {
  const match = PROCESSING_STEPS.find((step) => step.key === stepKey);
  return match?.label || stepKey;
}

export function isValidProcessingStep(stepKey) {
  return PROCESSING_STEP_KEYS.includes(stepKey);
}

export function validateProcessingStepTransition(oldStep, newStep) {
  if (!newStep) return true;
  if (!isValidProcessingStep(newStep)) return false;

  const oldIndex = oldStep ? PROCESSING_STEP_KEYS.indexOf(oldStep) : -1;
  const newIndex = PROCESSING_STEP_KEYS.indexOf(newStep);

  if (newIndex <= oldIndex) return true;
  return newIndex === oldIndex + 1;
}

export function buildProcessingStepCommentText(stepKey) {
  return `Processing step: ${getProcessingStepLabel(stepKey)}`;
}

export function appendProcessingStepComment(lead, { userId, stepKey, timestamp = new Date() }) {
  if (!stepKey) return false;

  const comment = {
    text: buildProcessingStepCommentText(stepKey),
    author: userId,
    isSystem: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!Array.isArray(lead.comments)) {
    lead.comments = [];
  }
  lead.comments.push(comment);
  return true;
}

export { PROCESSING_STEP_HIRED_KEY, PROCESSING_STEP_KEYS };

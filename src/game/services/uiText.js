import { ELEMENT_TYPES } from '../constants.js';
import { getAverageScore, getScoreStats } from './scoreStorage.js';

export function getDraftErrorText(draftElement) {
  if (draftElement.kind === ELEMENT_TYPES.shape) {
    if (!draftElement.shape) {
      return 'Choose a shape type';
    }

    return 'Collision';
  }

  if (draftElement.kind === ELEMENT_TYPES.joint) {
    return 'Select two different shapes and valid time';
  }

  if (draftElement.kind === ELEMENT_TYPES.force) {
    return 'Select a shape, direction, and valid time';
  }

  return 'Only one gravity modifier is allowed';
}

export function getElementNote(elementType) {
  if (elementType === ELEMENT_TYPES.joint) {
    return 'Cost: 3. Connects two player shapes on play.';
  }

  if (elementType === ELEMENT_TYPES.force) {
    return 'Cost: 3. Applies force to one player shape on play.';
  }

  if (elementType === ELEMENT_TYPES.gravity) {
    return 'Cost: 10. Adds one gravity modifier to the level.';
  }

  return 'Cost: 1. Adds one player shape.';
}

export function getStatsText() {
  const stats = getScoreStats();
  const average = getAverageScore(stats);

  if (average === null) {
    return 'No stats yet';
  }

  return `Best: ${stats.best}, worst: ${stats.worst}, average: ${average.toFixed(1)}`;
}

export function getTimerText(elapsedSeconds, heldSeconds, requiredHoldSeconds) {
  const hold = heldSeconds.toFixed(1);
  const time = elapsedSeconds.toFixed(1);
  return `Time: ${time}. On target: ${hold}/${requiredHoldSeconds}`;
}

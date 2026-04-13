import { isShapeInsideShape } from './shapeGeometry.js';

export function areAllBaseShapesPlaced(baseShapes, goals, tolerance) {
  if (baseShapes.length > goals.length) {
    return false;
  }

  return searchPlacement(baseShapes, goals, new Set(), 0, tolerance);
}

function searchPlacement(baseShapes, goals, usedGoalIndexes, shapeIndex, tolerance) {
  if (shapeIndex >= baseShapes.length) {
    return true;
  }

  return goals.some((goal, goalIndex) => {
    return canUseGoal(baseShapes, goals, usedGoalIndexes, shapeIndex, goalIndex, tolerance);
  });
}

function canUseGoal(baseShapes, goals, usedGoalIndexes, shapeIndex, goalIndex, tolerance) {
  if (usedGoalIndexes.has(goalIndex)) {
    return false;
  }

  if (!isShapeInsideShape(baseShapes[shapeIndex], goals[goalIndex], tolerance)) {
    return false;
  }

  const nextUsedGoalIndexes = new Set(usedGoalIndexes);
  nextUsedGoalIndexes.add(goalIndex);

  return searchPlacement(baseShapes, goals, nextUsedGoalIndexes, shapeIndex + 1, tolerance);
}

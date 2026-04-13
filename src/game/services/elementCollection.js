import { SCORE_COSTS } from '../constants.js';

export function getStoredElements(playerShapes, playerJoints, playerForces, gravityModifier) {
  const gravityElements = gravityModifier ? [gravityModifier] : [];

  return [
    ...playerShapes,
    ...playerJoints,
    ...playerForces,
    ...gravityElements,
  ];
}

export function getElementValue(element) {
  return `${element.kind}:${element.name}`;
}

export function getElementByValue(elements, elementValue) {
  return elements.find((element) => {
    return getElementValue(element) === elementValue;
  });
}

export function getScore(playerShapes, playerJoints, playerForces, gravityModifier) {
  const gravityScore = gravityModifier ? SCORE_COSTS.gravity : 0;

  return playerShapes.length * SCORE_COSTS.shape
    + playerJoints.length * SCORE_COSTS.joint
    + playerForces.length * SCORE_COSTS.force
    + gravityScore;
}

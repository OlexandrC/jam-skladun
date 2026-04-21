import { DEFAULTS, ELEMENT_TYPES, WORLD_LIMIT } from '../constants.js';
import { getNumberInput, getOptionalNumberInput } from './formInput.js';
import { getBaseAngle, getShapeSize, makePlayerShape } from './shapeFactory.js';
import { isShapeColliding } from './shapeGeometry.js';

const SHAPE_TYPES = ['circle', 'rectangle', 'triangle'];

export function makeDraftElement(ui, elementCounters, selectedElement) {
  const elementType = ui.elementType.value;

  if (elementType === ELEMENT_TYPES.joint) {
    return makeDraftJoint(ui, elementCounters, selectedElement);
  }

  if (elementType === ELEMENT_TYPES.force) {
    return makeDraftForce(ui, elementCounters, selectedElement);
  }

  if (elementType === ELEMENT_TYPES.gravity) {
    return makeDraftGravity(ui, selectedElement);
  }

  return makeDraftShape(ui, elementCounters, selectedElement);
}

export function getDraftShape(draftElement) {
  if (draftElement.kind !== ELEMENT_TYPES.shape || !isShapeTypeValid(draftElement.shape)) {
    return null;
  }

  return draftElement;
}

export function isDraftElementValid(draftElement, draftShape, context) {
  if (draftElement.kind === ELEMENT_TYPES.shape) {
    return isDraftShapeValid(draftShape, context.collisionShapes);
  }

  if (draftElement.kind === ELEMENT_TYPES.joint) {
    return isDraftJointValid(draftElement, context.playerShapes);
  }

  if (draftElement.kind === ELEMENT_TYPES.force) {
    return isDraftForceValid(draftElement, context.playerShapes);
  }

  return isDraftGravityValid(context.selectedElement, context.gravityModifier);
}

export function setFormFromElement(ui, element) {
  if (element.kind === ELEMENT_TYPES.shape) {
    setFormFromShape(ui, element);
    return;
  }

  if (element.kind === ELEMENT_TYPES.joint) {
    setFormFromJoint(ui, element);
    return;
  }

  if (element.kind === ELEMENT_TYPES.force) {
    setFormFromForce(ui, element);
    return;
  }

  setFormFromGravity(ui, element);
}

function makeDraftShape(ui, elementCounters, selectedElement) {
  return {
    kind: ELEMENT_TYPES.shape,
    ...makePlayerShape({
      name: getDraftName(ELEMENT_TYPES.shape, ui, elementCounters, selectedElement),
      shape: ui.shapeType.value,
      x: getNumberInput(ui.shapeX, 0, -WORLD_LIMIT, WORLD_LIMIT),
      y: getNumberInput(ui.shapeY, 0, -WORLD_LIMIT, WORLD_LIMIT),
      size: getNumberInput(ui.shapeSize, DEFAULTS.shapeSize, 5, 500),
      mass: getNumberInput(ui.shapeMass, DEFAULTS.mass, 1, 1000),
      angle: degreesToRadians(getNumberInput(ui.shapeAngle, 0, 0, 360)),
      fixedX: ui.shapeFixedX.checked,
      fixedY: ui.shapeFixedY.checked,
      fixedAngle: ui.shapeFixedAngle.checked,
    }),
  };
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
  return Math.round(radians * 180 / Math.PI);
}

function makeDraftJoint(ui, elementCounters, selectedElement) {
  return {
    kind: ELEMENT_TYPES.joint,
    name: getDraftName(ELEMENT_TYPES.joint, ui, elementCounters, selectedElement),
    firstShapeName: ui.jointFirstShape.value,
    secondShapeName: ui.jointSecondShape.value,
    strength: getNumberInput(ui.jointStrength, DEFAULTS.jointStrength, 0.0001, 0.01),
    distance: getNumberInput(ui.jointDistance, DEFAULTS.jointDistance, 0, 2000),
    startSeconds: getNumberInput(ui.jointStart, DEFAULTS.jointStartSeconds, 0, 9999),
    endSeconds: getOptionalNumberInput(ui.jointEnd, 0, 9999),
  };
}

function makeDraftForce(ui, elementCounters, selectedElement) {
  return {
    kind: ELEMENT_TYPES.force,
    name: getDraftName(ELEMENT_TYPES.force, ui, elementCounters, selectedElement),
    shapeName: ui.forceShape.value,
    strength: getNumberInput(ui.forceStrength, DEFAULTS.forceStrength, 0, 1000),
    directionX: getNumberInput(ui.forceDirectionX, DEFAULTS.forceDirectionX, -10, 10),
    directionY: getNumberInput(ui.forceDirectionY, DEFAULTS.forceDirectionY, -10, 10),
    startSeconds: getNumberInput(ui.forceStart, DEFAULTS.forceStartSeconds, 0, 9999),
    endSeconds: getOptionalNumberInput(ui.forceEnd, 0, 9999),
  };
}

function makeDraftGravity(ui, selectedElement) {
  return {
    kind: ELEMENT_TYPES.gravity,
    name: getDraftName(ELEMENT_TYPES.gravity, ui, {}, selectedElement),
    x: getNumberInput(ui.gravityX, DEFAULTS.gravityModifierX, -10, 10),
    y: getNumberInput(ui.gravityY, DEFAULTS.gravityModifierY, -10, 10),
  };
}

function getDraftName(elementType, ui, elementCounters, selectedElement) {
  if (selectedElement) {
    return selectedElement.name;
  }

  if (elementType === ELEMENT_TYPES.shape) {
    return getNextShapeName(ui, elementCounters);
  }

  if (elementType === ELEMENT_TYPES.gravity) {
    return 'gravity_01';
  }

  return getNextNamedElementName(elementType, elementCounters);
}

function getNextShapeName(ui, elementCounters) {
  const shapeType = ui.shapeType.value;
  const nextIndex = (elementCounters[shapeType] ?? 0) + 1;

  if (!isShapeTypeValid(shapeType)) {
    return 'shape_preview';
  }

  return `${shapeType}_${String(nextIndex).padStart(2, '0')}`;
}

function getNextNamedElementName(elementType, elementCounters) {
  const nextIndex = elementCounters[elementType] + 1;
  const prefix = elementType === ELEMENT_TYPES.joint ? 'join' : elementType;

  return `${prefix}_${String(nextIndex).padStart(2, '0')}`;
}

function isDraftShapeValid(draftShape, collisionShapes) {
  if (!draftShape) {
    return false;
  }

  return !collisionShapes.some((collider) => {
    return isShapeColliding(draftShape, collider);
  });
}

function isShapeTypeValid(shapeType) {
  return SHAPE_TYPES.includes(shapeType);
}

function isDraftJointValid(joint, playerShapes) {
  if (!joint.firstShapeName || !joint.secondShapeName) {
    return false;
  }

  return joint.firstShapeName !== joint.secondShapeName
    && hasPlayerShape(playerShapes, joint.firstShapeName)
    && hasPlayerShape(playerShapes, joint.secondShapeName)
    && isTimeWindowValid(joint);
}

function isDraftForceValid(force, playerShapes) {
  const hasDirection = force.directionX !== 0 || force.directionY !== 0;

  return hasPlayerShape(playerShapes, force.shapeName) && hasDirection && isTimeWindowValid(force);
}

function isTimeWindowValid(element) {
  return element.endSeconds === null || element.endSeconds >= element.startSeconds;
}

function isDraftGravityValid(selectedElement, gravityModifier) {
  if (!gravityModifier) {
    return true;
  }

  return selectedElement?.kind === ELEMENT_TYPES.gravity;
}

function hasPlayerShape(playerShapes, shapeName) {
  return playerShapes.some((shape) => shape.name === shapeName);
}

function setFormFromShape(ui, shape) {
  ui.shapeType.value = shape.shape;
  ui.shapeX.value = Math.round(shape.x);
  ui.shapeY.value = Math.round(shape.y);
  ui.shapeSize.value = Math.round(getShapeSize(shape));
  ui.shapeMass.value = Math.round(shape.mass);
  ui.shapeAngle.value = radiansToDegrees((shape.angle ?? 0) - getBaseAngle(shape.shape));
  ui.shapeFixedX.checked = Boolean(shape.fixedX);
  ui.shapeFixedY.checked = Boolean(shape.fixedY);
  ui.shapeFixedAngle.checked = Boolean(shape.fixedAngle);
}

function setFormFromJoint(ui, joint) {
  ui.jointFirstShape.value = joint.firstShapeName;
  ui.jointSecondShape.value = joint.secondShapeName;
  ui.jointStrength.value = joint.strength;
  ui.jointDistance.value = joint.distance;
  ui.jointStart.value = joint.startSeconds ?? DEFAULTS.jointStartSeconds;
  ui.jointEnd.value = joint.endSeconds ?? '';
}

function setFormFromForce(ui, force) {
  ui.forceShape.value = force.shapeName;
  ui.forceStrength.value = force.strength;
  ui.forceDirectionX.value = force.directionX;
  ui.forceDirectionY.value = force.directionY;
  ui.forceStart.value = force.startSeconds;
  ui.forceEnd.value = force.endSeconds ?? '';
}

function setFormFromGravity(ui, gravity) {
  ui.gravityX.value = gravity.x;
  ui.gravityY.value = gravity.y;
}

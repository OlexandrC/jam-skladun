import { ELEMENT_TYPES } from '../constants.js';
import {
  getElementByValue,
  getScore,
  getStoredElements,
} from './elementCollection.js';

export class PlayerElementStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.playerShapes = [];
    this.playerJoints = [];
    this.playerForces = [];
    this.gravityModifier = null;
    this.elementCounters = makeElementCounters();
  }

  getElements() {
    return getStoredElements(
      this.playerShapes,
      this.playerJoints,
      this.playerForces,
      this.gravityModifier,
    );
  }

  getElementByValue(elementValue) {
    return getElementByValue(this.getElements(), elementValue);
  }

  getScore() {
    return getScore(
      this.playerShapes,
      this.playerJoints,
      this.playerForces,
      this.gravityModifier,
    );
  }

  getShapeByName(shapeName) {
    return this.playerShapes.find((shape) => shape.name === shapeName);
  }

  getShapeNames() {
    return this.playerShapes.map((shape) => shape.name);
  }

  getPlayerShapeColliders(shapeName) {
    return this.playerShapes.filter((shape) => shape.name !== shapeName);
  }

  setShape(updatedShape) {
    this.playerShapes = this.playerShapes.map((shape) => {
      return shape.name === updatedShape.name ? updatedShape : shape;
    });
  }

  addDraftElement(draftElement) {
    if (draftElement.kind === ELEMENT_TYPES.shape) {
      this.addShape(draftElement);
      return;
    }

    this.addNonShapeElement(draftElement);
  }

  updateDraftElement(draftElement) {
    if (draftElement.kind === ELEMENT_TYPES.shape) {
      this.updateShape(draftElement);
      return;
    }

    if (draftElement.kind === ELEMENT_TYPES.joint) {
      this.updateJoint(draftElement);
      return;
    }

    if (draftElement.kind === ELEMENT_TYPES.force) {
      this.updateForce(draftElement);
      return;
    }

    this.gravityModifier = { ...draftElement };
  }

  deleteElement(element) {
    if (!element) {
      return;
    }

    if (element.kind === ELEMENT_TYPES.shape) {
      this.deleteShape(element.name);
      return;
    }

    this.deleteNonShapeElement(element);
  }

  addShape(shape) {
    this.playerShapes.push({ ...shape });
    this.elementCounters[shape.shape] += 1;
  }

  addNonShapeElement(element) {
    if (element.kind === ELEMENT_TYPES.joint) {
      this.playerJoints.push({ ...element });
      this.elementCounters.joint += 1;
      return;
    }

    if (element.kind === ELEMENT_TYPES.force) {
      this.playerForces.push({ ...element });
      this.elementCounters.force += 1;
      return;
    }

    this.gravityModifier = { ...element };
  }

  updateShape(updatedShape) {
    this.playerShapes = this.playerShapes.map((shape) => {
      return shape.name === updatedShape.name ? { ...updatedShape } : shape;
    });
  }

  updateJoint(updatedJoint) {
    this.playerJoints = this.playerJoints.map((joint) => {
      return joint.name === updatedJoint.name ? { ...updatedJoint } : joint;
    });
  }

  updateForce(updatedForce) {
    this.playerForces = this.playerForces.map((force) => {
      return force.name === updatedForce.name ? { ...updatedForce } : force;
    });
  }

  deleteShape(shapeName) {
    this.playerShapes = this.playerShapes.filter((shape) => shape.name !== shapeName);
    this.deleteShapeJoints(shapeName);
    this.deleteShapeForces(shapeName);
  }

  deleteShapeJoints(shapeName) {
    this.playerJoints = this.playerJoints.filter((joint) => {
      return joint.firstShapeName !== shapeName && joint.secondShapeName !== shapeName;
    });
  }

  deleteShapeForces(shapeName) {
    this.playerForces = this.playerForces.filter((force) => {
      return force.shapeName !== shapeName;
    });
  }

  deleteNonShapeElement(element) {
    if (element.kind === ELEMENT_TYPES.joint) {
      this.playerJoints = this.playerJoints.filter((joint) => joint.name !== element.name);
      return;
    }

    if (element.kind === ELEMENT_TYPES.force) {
      this.playerForces = this.playerForces.filter((force) => force.name !== element.name);
      return;
    }

    this.gravityModifier = null;
  }
}

function makeElementCounters() {
  return {
    circle: 0,
    rectangle: 0,
    triangle: 0,
    joint: 0,
    force: 0,
  };
}

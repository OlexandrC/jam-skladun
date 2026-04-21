import Phaser from 'phaser';
import {
  createMatterBody,
  getBodyRecordName,
  getForceVector,
  getShapeFromBodyRecord,
  isBodyOutsideWorld,
  isForceActive,
} from './runPhysics.js';

export class RunSession {
  constructor(matter) {
    this.matter = matter;
    this.clearState();
  }

  start(level, playerShapes, playerJoints) {
    this.clear();
    this.addLevelBodies(level);
    this.addShapeBodies(playerShapes, 'player', false);
    this.baseBodyRecords = this.runBodies.filter((record) => record.kind === 'base');
    this.createConstraints(playerJoints);
  }

  clear() {
    this.removeConstraints();
    this.removeBodies();
    this.clearState();
  }

  update(elapsedSeconds, playerForces) {
    this.clearBodiesOutsideWorld();
    this.clearInactiveConstraints();
    this.applyActiveForces(playerForces, elapsedSeconds);
  }

  getBodyRecordByName(name) {
    return this.runBodies.find((record) => {
      return getBodyRecordName(record) === name;
    });
  }

  getActiveBaseShapes() {
    return this.baseBodyRecords
      .filter((record) => record.active)
      .map((record) => getShapeFromBodyRecord(record));
  }

  addLevelBodies(level) {
    this.addShapeBodies(level.walls ?? [], 'wall', true);
    this.addObstacleBodies(level.obstacles ?? []);
    this.addShapeBodies(level.baseShapes ?? [], 'base', false);
  }

  addObstacleBodies(obstacles) {
    obstacles.forEach((shape) => {
      this.addBodyRecord(shape, 'obstacle', shape.isStatic);
    });
  }

  addShapeBodies(shapes, kind, isStatic) {
    shapes.forEach((shape) => {
      this.addBodyRecord(shape, kind, isStatic);
    });
  }

  addBodyRecord(shape, kind, isStatic) {
    const body = createMatterBody(this.matter, shape, Boolean(isStatic));

    this.runBodies.push({
      body,
      shape,
      kind,
      active: true,
    });
  }

  createConstraints(playerJoints) {
    playerJoints.forEach((joint) => {
      this.createConstraint(joint);
    });
  }

  createConstraint(joint) {
    const firstRecord = this.getBodyRecordByName(joint.firstShapeName);
    const secondRecord = this.getBodyRecordByName(joint.secondShapeName);

    if (!firstRecord || !secondRecord) {
      return;
    }

    this.addConstraint(joint, firstRecord.body, secondRecord.body);
  }

  addConstraint(joint, firstBody, secondBody) {
    const constraint = this.matter.add.constraint(
      firstBody,
      secondBody,
      joint.distance,
      joint.strength,
      { label: joint.name },
    );

    this.runConstraints.push({ constraint, joint });
  }

  applyActiveForces(playerForces, elapsedSeconds) {
    playerForces.forEach((force) => {
      if (!isForceActive(force, elapsedSeconds)) {
        return;
      }

      this.applyForceToBody(force);
    });
  }

  applyForceToBody(force) {
    const record = this.getBodyRecordByName(force.shapeName);

    if (!record?.active) {
      return;
    }

    Phaser.Physics.Matter.Matter.Body.applyForce(
      record.body,
      record.body.position,
      getForceVector(force),
    );
  }

  clearBodiesOutsideWorld() {
    this.runBodies.forEach((record) => {
      if (!record.active || !isBodyOutsideWorld(record.body)) {
        return;
      }

      record.active = false;
      this.matter.world.remove(record.body);
    });
  }

  clearInactiveConstraints() {
    this.runConstraints = this.runConstraints.filter((record) => {
      if (this.isConstraintActive(record.constraint)) {
        return true;
      }

      this.matter.world.remove(record.constraint);
      return false;
    });
  }

  isConstraintActive(constraint) {
    return this.isBodyActive(constraint.bodyA) && this.isBodyActive(constraint.bodyB);
  }

  isBodyActive(body) {
    return this.runBodies.some((record) => {
      return record.active && record.body === body;
    });
  }

  removeConstraints() {
    this.runConstraints.forEach((record) => {
      this.matter.world.remove(record.constraint);
    });
  }

  removeBodies() {
    this.runBodies.forEach((record) => {
      this.matter.world.remove(record.body);
    });
  }

  clearState() {
    this.runBodies = [];
    this.runConstraints = [];
    this.baseBodyRecords = [];
  }
}

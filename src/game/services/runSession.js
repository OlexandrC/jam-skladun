import Phaser from 'phaser';
import { PHYSICS } from '../constants.js';
import {
  createMatterBody,
  getBodyRecordName,
  getForceVector,
  getShapeFromBodyRecord,
  isBodyOutsideWorld,
  isForceActive,
  isTimeWindowActive,
  wakeMatterBody,
} from './runPhysics.js';

const MatterBody = Phaser.Physics.Matter.Matter.Body;

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
    this.setJointRecords(playerJoints);
    this.updateActiveConstraints(0);
  }

  clear() {
    this.removeConstraints();
    this.removeBodies();
    this.clearState();
  }

  step(elapsedSeconds, playerForces, deltaMilliseconds) {
    this.updateActiveConstraints(elapsedSeconds);
    this.applyPlayerShapeLocks();
    this.applyActiveForces(playerForces, elapsedSeconds);
    this.matter.world.step(deltaMilliseconds);
    this.clearBodiesOutsideWorld();
  }

  getBodyRecordByName(name) {
    return this.runBodies.find((record) => {
      return getBodyRecordName(record) === name;
    });
  }

  getBodyRecordByBody(body) {
    const bodyId = body?.parent?.id ?? body?.id;

    return this.runBodies.find((record) => record.body.id === bodyId);
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
    const record = {
      body,
      shape,
      kind,
      active: true,
      lockConstraint: null,
    };

    this.runBodies.push(record);
    this.configureBodyRecord(record);
  }

  configureBodyRecord(record) {
    if (record.kind !== 'player') {
      return;
    }

    this.configurePositionLock(record);
    this.configureAngleLock(record);
  }

  configurePositionLock(record) {
    if (!record.shape.fixedX || !record.shape.fixedY) {
      return;
    }

    record.lockConstraint = this.makeLockConstraint(record);
  }

  makeLockConstraint(record) {
    return this.matter.add.worldConstraint(
      record.body,
      0,
      PHYSICS.lockConstraintStiffness,
      {
        damping: PHYSICS.lockConstraintDamping,
        label: `${getBodyRecordName(record)}_lock`,
        pointA: {
          x: record.shape.x,
          y: record.shape.y,
        },
      },
    );
  }

  configureAngleLock(record) {
    if (!record.shape.fixedAngle) {
      return;
    }

    MatterBody.setInertia(record.body, Infinity);
    MatterBody.setAngularVelocity(record.body, 0);
    MatterBody.setAngle(record.body, record.shape.angle ?? 0);
  }

  setJointRecords(playerJoints) {
    this.runJointRecords = playerJoints.map((joint) => {
      return { joint, constraint: null };
    });
  }

  updateActiveConstraints(elapsedSeconds) {
    this.runJointRecords.forEach((record) => {
      this.updateConstraintRecord(record, elapsedSeconds);
    });
  }

  updateConstraintRecord(record, elapsedSeconds) {
    if (this.shouldConstraintBeActive(record, elapsedSeconds)) {
      this.addConstraintRecord(record);
      return;
    }

    this.removeConstraintRecord(record);
  }

  shouldConstraintBeActive(record, elapsedSeconds) {
    return isTimeWindowActive(record.joint, elapsedSeconds)
      && Boolean(this.getJointBodyPair(record.joint));
  }

  addConstraintRecord(record) {
    const bodyPair = this.getJointBodyPair(record.joint);

    if (record.constraint || !bodyPair) {
      return;
    }

    record.constraint = this.makeConstraint(record.joint, bodyPair.first, bodyPair.second);
  }

  makeConstraint(joint, firstBody, secondBody) {
    return this.matter.add.constraint(
      firstBody,
      secondBody,
      joint.distance,
      joint.strength,
      { label: joint.name },
    );
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

    const forceVector = this.getUnlockedForceVector(record, getForceVector(force));

    wakeMatterBody(record.body);
    Phaser.Physics.Matter.Matter.Body.applyForce(
      record.body,
      record.body.position,
      forceVector,
    );
  }

  getUnlockedForceVector(record, forceVector) {
    return {
      x: record.shape.fixedX ? 0 : forceVector.x,
      y: record.shape.fixedY ? 0 : forceVector.y,
    };
  }

  applyPlayerShapeLocks() {
    this.runBodies.forEach((record) => {
      if (!this.shouldApplyShapeLocks(record)) {
        return;
      }

      this.applyShapeLocks(record);
    });
  }

  shouldApplyShapeLocks(record) {
    return record.active
      && record.kind === 'player'
      && Boolean(record.shape.fixedX || record.shape.fixedY || record.shape.fixedAngle);
  }

  applyShapeLocks(record) {
    this.applyPositionLocks(record);
    this.applyAngleLock(record);
  }

  applyPositionLocks(record) {
    if (record.lockConstraint || (!record.shape.fixedX && !record.shape.fixedY)) {
      return;
    }

    MatterBody.setPosition(record.body, this.getLockedPosition(record));
    MatterBody.setVelocity(record.body, this.getLockedVelocity(record));
  }

  getLockedPosition(record) {
    return {
      x: record.shape.fixedX ? record.shape.x : record.body.position.x,
      y: record.shape.fixedY ? record.shape.y : record.body.position.y,
    };
  }

  getLockedVelocity(record) {
    return {
      x: record.shape.fixedX ? 0 : record.body.velocity.x,
      y: record.shape.fixedY ? 0 : record.body.velocity.y,
    };
  }

  applyAngleLock(record) {
    if (!record.shape.fixedAngle) {
      return;
    }

    MatterBody.setAngle(record.body, record.shape.angle ?? 0);
    MatterBody.setAngularVelocity(record.body, 0);
  }

  clearBodiesOutsideWorld() {
    this.runBodies.forEach((record) => {
      if (!record.active || !isBodyOutsideWorld(record.body)) {
        return;
      }

      record.active = false;
      this.removeBodyLock(record);
      this.matter.world.remove(record.body);
    });
  }

  getJointBodyPair(joint) {
    const firstRecord = this.getBodyRecordByName(joint.firstShapeName);
    const secondRecord = this.getBodyRecordByName(joint.secondShapeName);

    if (!firstRecord?.active || !secondRecord?.active) {
      return null;
    }

    return {
      first: firstRecord.body,
      second: secondRecord.body,
    };
  }

  removeConstraints() {
    this.runJointRecords.forEach((record) => {
      this.removeConstraintRecord(record);
    });
  }

  removeConstraintRecord(record) {
    if (!record.constraint) {
      return;
    }

    this.matter.world.remove(record.constraint);
    record.constraint = null;
  }

  removeBodies() {
    this.runBodies.forEach((record) => {
      this.removeBodyLock(record);
      this.matter.world.remove(record.body);
    });
  }

  removeBodyLock(record) {
    if (!record.lockConstraint) {
      return;
    }

    this.matter.world.remove(record.lockConstraint);
    record.lockConstraint = null;
  }

  clearState() {
    this.runBodies = [];
    this.runJointRecords = [];
    this.baseBodyRecords = [];
  }
}

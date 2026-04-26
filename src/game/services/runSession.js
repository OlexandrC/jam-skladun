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
    const stepCount = this.getStepCount(
      deltaMilliseconds,
      playerForces,
      elapsedSeconds,
    );
    const stepDeltaMilliseconds = deltaMilliseconds / stepCount;

    for (let index = 0; index < stepCount; index += 1) {
      this.runStep(playerForces, elapsedSeconds, stepDeltaMilliseconds);
    }

    this.clearBodiesOutsideWorld();
  }

  runStep(playerForces, elapsedSeconds, deltaMilliseconds) {
    this.applyPlayerShapeLocks();
    this.applyActiveForces(playerForces, elapsedSeconds);
    this.matter.world.step(deltaMilliseconds);
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

  getStepCount(deltaMilliseconds, playerForces, elapsedSeconds) {
    const maxAllowedTravelDistance = this.getMaxAllowedTravelDistance();

    if (maxAllowedTravelDistance <= 0) {
      return 1;
    }

    const maxTravelDistance = this.getMaxTravelDistance(
      deltaMilliseconds,
      playerForces,
      elapsedSeconds,
    );

    if (maxTravelDistance <= maxAllowedTravelDistance) {
      return 1;
    }

    return Math.min(
      PHYSICS.maxMicroStepsPerFixedStep,
      Math.ceil(maxTravelDistance / maxAllowedTravelDistance),
    );
  }

  getMaxAllowedTravelDistance() {
    const smallestBodySize = this.getSmallestActiveBodySize();

    if (!Number.isFinite(smallestBodySize) || smallestBodySize <= 0) {
      return 0;
    }

    return smallestBodySize * PHYSICS.maxBodyTravelRatio;
  }

  getSmallestActiveBodySize() {
    return this.runBodies.reduce((smallestSize, record) => {
      if (!record.active) {
        return smallestSize;
      }

      const bodySize = this.getShapeMinDimension(record.shape);

      if (bodySize <= 0) {
        return smallestSize;
      }

      return Math.min(smallestSize, bodySize);
    }, Infinity);
  }

  getShapeMinDimension(shape) {
    if (shape.shape === 'rectangle') {
      return Math.min(shape.width, shape.height);
    }

    if (shape.shape === 'circle') {
      return shape.radius * 2;
    }

    return shape.radius;
  }

  getMaxTravelDistance(deltaMilliseconds, playerForces, elapsedSeconds) {
    return this.runBodies.reduce((maxTravelDistance, record) => {
      if (!record.active || record.body.isStatic) {
        return maxTravelDistance;
      }

      const travelDistance = this.getBodyTravelDistance(
        record,
        deltaMilliseconds,
        playerForces,
        elapsedSeconds,
      );

      return Math.max(maxTravelDistance, travelDistance);
    }, 0);
  }

  getBodyTravelDistance(record, deltaMilliseconds, playerForces, elapsedSeconds) {
    return this.getLinearTravelDistance(record.body, deltaMilliseconds)
      + this.getAccelerationTravelDistance(
        record,
        playerForces,
        elapsedSeconds,
        deltaMilliseconds,
      );
  }

  getLinearTravelDistance(body, deltaMilliseconds) {
    return (body.speed ?? 0) * deltaMilliseconds / PHYSICS.matterBaseStepMs;
  }

  getAccelerationTravelDistance(record, playerForces, elapsedSeconds, deltaMilliseconds) {
    const acceleration = this.getAppliedAcceleration(record, playerForces, elapsedSeconds);

    return acceleration * deltaMilliseconds * deltaMilliseconds;
  }

  getAppliedAcceleration(record, playerForces, elapsedSeconds) {
    const gravity = this.getGravityAcceleration();
    const force = this.getForceAcceleration(record, playerForces, elapsedSeconds);

    return Math.hypot(gravity.x + force.x, gravity.y + force.y);
  }

  getGravityAcceleration() {
    const gravity = this.matter.world.engine.gravity;

    return {
      x: gravity.x * gravity.scale,
      y: gravity.y * gravity.scale,
    };
  }

  getForceAcceleration(record, playerForces, elapsedSeconds) {
    const acceleration = { x: 0, y: 0 };

    playerForces.forEach((force) => {
      if (!isForceActive(force, elapsedSeconds) || force.shapeName !== record.shape.name) {
        return;
      }

      const forceVector = this.getUnlockedForceVector(record, getForceVector(force));
      acceleration.x += forceVector.x / record.body.mass;
      acceleration.y += forceVector.y / record.body.mass;
    });

    return acceleration;
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

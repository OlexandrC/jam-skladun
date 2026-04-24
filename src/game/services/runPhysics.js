import Phaser from 'phaser';
import { DEFAULTS, PHYSICS, WORLD_LIMIT } from '../constants.js';

const MatterBodies = Phaser.Physics.Matter.Matter.Bodies;
const MatterSleeping = Phaser.Physics.Matter.Matter.Sleeping;

export function createMatterBody(matter, shape, isStatic) {
  const body = makeMatterBody(shape, isStatic);
  matter.world.add(body);
  return body;
}

export function makeMatterBody(shape, isStatic = false) {
  const options = getMatterOptions(shape, isStatic);

  if (shape.shape === 'circle') {
    return MatterBodies.circle(shape.x, shape.y, shape.radius, options);
  }

  if (shape.shape === 'rectangle') {
    return MatterBodies.rectangle(shape.x, shape.y, shape.width, shape.height, options);
  }

  return MatterBodies.polygon(shape.x, shape.y, 3, shape.radius, options);
}

export function wakeMatterBody(body) {
  MatterSleeping.set(body, false);
}

export function getForceVector(force) {
  const length = Math.hypot(force.directionX, force.directionY);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  const scale = force.strength * PHYSICS.forceScale;

  return {
    x: force.directionX / length * scale,
    y: force.directionY / length * scale,
  };
}

export function getShapeFromBodyRecord(record) {
  return {
    ...record.shape,
    x: record.body.position.x,
    y: record.body.position.y,
    angle: record.body.angle,
  };
}

export function getBodyRecordName(record) {
  return record.shape.name ?? record.shape.id;
}

export function isBodyOutsideWorld(body) {
  return Math.abs(body.position.x) > WORLD_LIMIT || Math.abs(body.position.y) > WORLD_LIMIT;
}

export function isForceActive(force, elapsedSeconds) {
  return isTimeWindowActive(force, elapsedSeconds);
}

export function isTimeWindowActive(element, elapsedSeconds) {
  const startSeconds = element.startSeconds ?? 0;
  const endSeconds = element.endSeconds ?? null;

  if (elapsedSeconds < startSeconds) {
    return false;
  }

  return endSeconds === null || elapsedSeconds <= endSeconds;
}

function getMatterOptions(shape, isStatic) {
  return {
    label: shape.name ?? shape.id,
    isStatic,
    angle: shape.angle ?? 0,
    mass: getMatterMass(shape),
    friction: PHYSICS.friction,
    frictionAir: PHYSICS.frictionAir,
    restitution: PHYSICS.restitution,
    sleepThreshold: PHYSICS.sleepThreshold,
    slop: PHYSICS.bodySlop,
  };
}

function getMatterMass(shape) {
  return (shape.mass ?? DEFAULTS.mass) * PHYSICS.massCoefficient;
}

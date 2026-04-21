import { DEFAULTS, GAME_AREA } from '../constants.js';

const FULL_CIRCLE = Math.PI * 2;
const WALL_THICKNESS = 30;
const SHAPE_TYPES = ['circle', 'rectangle', 'triangle'];
const BASE_SIZE = 28;
const GOAL_SIZE = 52;
const OBSTACLE_SIZE = 34;
const MIN_Y = 100;
const MAX_Y = 620;
const SIDE_X_RANGES = {
  left: { min: 90, max: 220 },
  right: { min: 740, max: 870 },
};
const GRAVITY_MIN = -10;
const GRAVITY_MAX = 10;

const LEVEL_CONFIGS = {
  1: { pairs: 1, fixedObstacles: 0, dynamicObstacles: 0 },
  2: { pairs: 1, fixedObstacles: 1, dynamicObstacles: 0 },
  3: { pairs: 2, fixedObstacles: 0, dynamicObstacles: 0 },
  4: { pairs: 2, fixedObstacles: 2, dynamicObstacles: 0 },
  5: { pairs: 3, fixedObstacles: 3, dynamicObstacles: 3 },
};

export function makeLevel(levelNumber) {
  const config = getLevelConfig(levelNumber);
  const pairs = makeShapePairs(config.pairs);

  return {
    id: `level-${config.levelNumber}`,
    name: String(config.levelNumber),
    levelNumber: config.levelNumber,
    gravity: makeRandomGravity(),
    timeLimitSeconds: DEFAULTS.timeLimitSeconds,
    requiredHoldSeconds: DEFAULTS.requiredHoldSeconds,
    tolerance: DEFAULTS.tolerance,
    walls: makeWalls(),
    baseShapes: pairs.map(makeBaseShape),
    goals: pairs.map(makeGoalShape),
    obstacles: makeObstacles(pairs, config),
  };
}

function getLevelConfig(levelNumber) {
  const normalizedLevel = Number(levelNumber);
  const resolvedLevel = LEVEL_CONFIGS[normalizedLevel] ? normalizedLevel : 1;
  const levelConfig = LEVEL_CONFIGS[resolvedLevel];

  return { ...levelConfig, levelNumber: resolvedLevel };
}

function makeShapePairs(count) {
  const baseSide = getRandomSide();
  const goalSide = getOppositeSide(baseSide);
  const baseYs = getRandomBandYs(count);
  const goalYs = getRandomBandYs(count);

  return Array.from({ length: count }, (_, index) => {
    return {
      index: index + 1,
      shape: getRandomShapeType(),
      basePoint: getRandomSidePoint(baseSide, baseYs[index]),
      goalPoint: getRandomSidePoint(goalSide, goalYs[index]),
    };
  });
}

function getRandomBandYs(count) {
  const bandHeight = (MAX_Y - MIN_Y) / count;
  const yValues = Array.from({ length: count }, (_, index) => {
    const minY = Math.round(MIN_Y + bandHeight * index + 35);
    const maxY = Math.round(MIN_Y + bandHeight * (index + 1) - 35);
    return getRandomInteger(minY, maxY);
  });

  return shuffleValues(yValues);
}

function makeBaseShape(pair) {
  return makeLevelShape({
    id: `base_${pair.index}`,
    name: `base_${pair.shape}_${formatIndex(pair.index)}`,
    shape: pair.shape,
    x: pair.basePoint.x,
    y: pair.basePoint.y,
    size: BASE_SIZE,
    mass: DEFAULTS.mass,
  });
}

function makeGoalShape(pair) {
  return makeLevelShape({
    id: `goal_${pair.index}`,
    name: `goal_${pair.shape}_${formatIndex(pair.index)}`,
    shape: pair.shape,
    x: pair.goalPoint.x,
    y: pair.goalPoint.y,
    size: GOAL_SIZE,
  });
}

function makeObstacles(pairs, config) {
  return [
    ...makeFixedObstacles(pairs, config.fixedObstacles),
    ...makeDynamicObstacles(pairs, config.dynamicObstacles),
  ];
}

function makeFixedObstacles(pairs, count) {
  return pairs.slice(0, count).map((pair, index) => {
    return makeObstacle(index + 1, getPathPoint(pair, 0.5), true);
  });
}

function makeDynamicObstacles(pairs, count) {
  return Array.from({ length: count }, (_, index) => {
    const pair = pairs[index % pairs.length];
    const progress = index % 2 === 0 ? 0.35 : 0.65;
    return makeObstacle(index + 1, getPathPoint(pair, progress, getRandomOffset()), false);
  });
}

function makeObstacle(index, point, isStatic) {
  return makeLevelShape({
    id: `obstacle_${isStatic ? 'fixed' : 'free'}_${formatIndex(index)}`,
    name: `obstacle_${isStatic ? 'fixed' : 'free'}_${formatIndex(index)}`,
    shape: getRandomShapeType(),
    x: point.x,
    y: point.y,
    size: OBSTACLE_SIZE,
    mass: DEFAULTS.mass,
    isStatic,
  });
}

function getPathPoint(pair, progress, yOffset = 0) {
  return {
    x: Math.round(pair.basePoint.x + (pair.goalPoint.x - pair.basePoint.x) * progress),
    y: clampY(Math.round(pair.basePoint.y + (pair.goalPoint.y - pair.basePoint.y) * progress + yOffset)),
  };
}

function makeLevelShape(values) {
  const baseShape = getBaseShape(values);

  if (values.shape === 'rectangle') {
    return { ...baseShape, width: values.size * 2, height: values.size * 2 };
  }

  return { ...baseShape, radius: values.size };
}

function getBaseShape(values) {
  const shape = {
    id: values.id,
    name: values.name,
    shape: values.shape,
    x: values.x,
    y: values.y,
    angle: getRandomAngle(),
  };

  if (values.mass !== undefined) {
    shape.mass = values.mass;
  }

  if (values.isStatic !== undefined) {
    shape.isStatic = values.isStatic;
  }

  return shape;
}

function makeWalls() {
  return [
    makeWall('top', GAME_AREA.width / 2, WALL_THICKNESS / 2, GAME_AREA.width, WALL_THICKNESS),
    makeWall(
      'bottom',
      GAME_AREA.width / 2,
      GAME_AREA.height - WALL_THICKNESS / 2,
      GAME_AREA.width,
      WALL_THICKNESS,
    ),
    makeWall('left', WALL_THICKNESS / 2, GAME_AREA.height / 2, WALL_THICKNESS, GAME_AREA.height),
    makeWall(
      'right',
      GAME_AREA.width - WALL_THICKNESS / 2,
      GAME_AREA.height / 2,
      WALL_THICKNESS,
      GAME_AREA.height,
    ),
  ];
}

function makeWall(id, x, y, width, height) {
  return {
    id: `wall_${id}`,
    shape: 'rectangle',
    x,
    y,
    width,
    height,
    isStatic: true,
  };
}

function getRandomShapeType() {
  return SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
}

function makeRandomGravity() {
  const gravity = {
    x: getRandomInteger(GRAVITY_MIN, GRAVITY_MAX),
    y: getRandomInteger(GRAVITY_MIN, GRAVITY_MAX),
  };

  if (gravity.x === 0 && gravity.y === 0) {
    return { x: 0, y: DEFAULTS.gravityY };
  }

  return gravity;
}

function getRandomSide() {
  return Math.random() < 0.5 ? 'left' : 'right';
}

function getOppositeSide(side) {
  return side === 'left' ? 'right' : 'left';
}

function getRandomSidePoint(side, y) {
  const range = SIDE_X_RANGES[side];

  return {
    x: getRandomInteger(range.min, range.max),
    y,
  };
}

function getRandomOffset() {
  return Math.round(Math.random() * 60 - 30);
}

function getRandomAngle() {
  return Math.random() * FULL_CIRCLE;
}

function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleValues(values) {
  const shuffledValues = [...values];

  for (let index = shuffledValues.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomInteger(0, index);
    const currentValue = shuffledValues[index];
    shuffledValues[index] = shuffledValues[swapIndex];
    shuffledValues[swapIndex] = currentValue;
  }

  return shuffledValues;
}

function clampY(y) {
  return Math.max(MIN_Y, Math.min(MAX_Y, y));
}

function formatIndex(index) {
  return String(index).padStart(2, '0');
}

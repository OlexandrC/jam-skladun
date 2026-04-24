export const GAME_AREA = {
  width: 960,
  height: 720,
  panelWidth: 320,
};

export const WORLD_LIMIT = 100000;

export const COLORS = {
  background: 0x1B2130,
  obstacle: 0xA8B3C7,
  wall: 0xA8B3C7,
  base: 0x7070ff,
  player: 0xa894e0,
  goal: 0xa2ecd3,
  joint: 0xd4aeae,
  force: 0xFFB84D,
  invalid: 0xff5050,
  selected: 0xffffff,
  text: '#eef4ff',
};

export const DEFAULTS = {
  mass: 10,
  gravityX: 0,
  gravityY: 9,
  gravityModifierX: 0,
  gravityModifierY: 0,
  jointDistance: 120,
  jointStartSeconds: 0,
  jointStrength: 0.002,
  forceDirectionX: 1,
  forceDirectionY: 0,
  forceStartSeconds: 0,
  forceStrength: 10,
  shapeSize: 40,
  requiredHoldSeconds: 1,
  timeLimitSeconds: 60,
  tolerance: 0.1,
};

export const PHYSICS = {
  fixedStepMs: 1000 / 120,
  maxSubSteps: 12,
  maxFrameDeltaMs: 100,
  gravityScale: 0.001,
  gravityCoefficient: 0.5,
  massCoefficient: 0.5,
  friction: 0.2,
  frictionAir: 0.01,
  forceScale: 0.00005,
  restitution: 0.12,
  positionIterations: 16,
  velocityIterations: 12,
  constraintIterations: 6,
  sleepThreshold: 120,
  bodySlop: 0.01,
  lockConstraintStiffness: 0.98,
  lockConstraintDamping: 0.1,
};

export const SCORE_COSTS = {
  shape: 1,
  joint: 3,
  force: 3,
  gravity: 10,
};

export const ELEMENT_TYPES = {
  shape: 'shape',
  joint: 'joint',
  force: 'force',
  gravity: 'gravity',
};

export const STORAGE_KEYS = {
  scoreStats: 'jam-skladun.scoreStats',
};

export const UI_IDS = {
  levelSelect: 'level-select',
  generateLevelButton: 'generate-level-button',
  headerGravityText: 'header-gravity-text',
  elementType: 'element-type',
  elementNote: 'element-note',
  elementList: 'element-list',
  shapeSelect: 'shape-select',
  shapeType: 'shape-type',
  shapeX: 'shape-x',
  shapeY: 'shape-y',
  shapeSize: 'shape-size',
  shapeMass: 'shape-mass',
  shapeAngle: 'shape-angle',
  shapeFixedX: 'shape-fixed-x',
  shapeFixedY: 'shape-fixed-y',
  shapeFixedAngle: 'shape-fixed-angle',
  jointFirstShape: 'joint-first-shape',
  jointSecondShape: 'joint-second-shape',
  jointStrength: 'joint-strength',
  jointDistance: 'joint-distance',
  jointStart: 'joint-start',
  jointEnd: 'joint-end',
  forceShape: 'force-shape',
  forceStrength: 'force-strength',
  forceDirectionX: 'force-direction-x',
  forceDirectionY: 'force-direction-y',
  forceStart: 'force-start',
  forceEnd: 'force-end',
  gravityX: 'gravity-x',
  gravityY: 'gravity-y',
  sceneGravityText: 'scene-gravity-text',
  addShape: 'add-shape',
  updateShape: 'update-shape',
  cancelShape: 'cancel-shape',
  deleteShape: 'delete-shape',
  playButton: 'play-button',
  stopButton: 'stop-button',
  resetButton: 'reset-button',
  statusText: 'status-text',
  scoreText: 'score-text',
  timerText: 'timer-text',
};

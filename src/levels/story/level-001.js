import { DEFAULTS, GAME_AREA } from '../../game/constants.js';

const WALL_THICKNESS = 30;

export default {
  id: 'story-001',
  name: 'First Push',
  gravity: {
    x: DEFAULTS.gravityX,
    y: DEFAULTS.gravityY,
  },
  timeLimitSeconds: 60,
  requiredHoldSeconds: DEFAULTS.requiredHoldSeconds,
  tolerance: DEFAULTS.tolerance,
  walls: [
    {
      id: 'wall_top',
      shape: 'rectangle',
      x: GAME_AREA.width / 2,
      y: WALL_THICKNESS / 2,
      width: GAME_AREA.width,
      height: WALL_THICKNESS,
      isStatic: true,
    },
    {
      id: 'wall_bottom',
      shape: 'rectangle',
      x: GAME_AREA.width / 2,
      y: GAME_AREA.height - WALL_THICKNESS / 2,
      width: GAME_AREA.width,
      height: WALL_THICKNESS,
      isStatic: true,
    },
    {
      id: 'wall_left',
      shape: 'rectangle',
      x: WALL_THICKNESS / 2,
      y: GAME_AREA.height / 2,
      width: WALL_THICKNESS,
      height: GAME_AREA.height,
      isStatic: true,
    },
    {
      id: 'wall_right',
      shape: 'rectangle',
      x: GAME_AREA.width - WALL_THICKNESS / 2,
      y: GAME_AREA.height / 2,
      width: WALL_THICKNESS,
      height: GAME_AREA.height,
      isStatic: true,
    },
  ],
  baseShapes: [
    {
      id: 'base_circle_01',
      name: 'base_circle_01',
      shape: 'circle',
      x: 165,
      y: 245,
      radius: 28,
      mass: DEFAULTS.mass,
    },
    {
      id: 'base_rectangle_01',
      name: 'base_rectangle_01',
      shape: 'rectangle',
      x: 165,
      y: 470,
      width: 56,
      height: 56,
      mass: DEFAULTS.mass,
    },
  ],
  goals: [
    {
      id: 'goal_circle_01',
      name: 'goal_circle_01',
      shape: 'circle',
      x: 770,
      y: 245,
      radius: 52,
    },
    {
      id: 'goal_rectangle_01',
      name: 'goal_rectangle_01',
      shape: 'rectangle',
      x: 770,
      y: 470,
      width: 112,
      height: 112,
    },
  ],
  obstacles: [],
};

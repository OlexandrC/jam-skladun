import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { COLORS, GAME_AREA, PHYSICS } from './constants.js';

export function makeGameConfig(levels) {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: GAME_AREA.width,
    height: GAME_AREA.height,
    backgroundColor: COLORS.background,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'matter',
      matter: {
        autoUpdate: false,
        debug: false,
        enableSleeping: true,
        gravity: { x: 0, y: 0 },
        positionIterations: PHYSICS.positionIterations,
        velocityIterations: PHYSICS.velocityIterations,
        constraintIterations: PHYSICS.constraintIterations,
      },
    },
    scene: [new GameScene(levels)],
  };
}

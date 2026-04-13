import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { COLORS, GAME_AREA } from './constants.js';

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
        debug: false,
        gravity: { x: 0, y: 0 },
      },
    },
    scene: [new GameScene(levels)],
  };
}

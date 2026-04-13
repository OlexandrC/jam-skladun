import Phaser from 'phaser';
import './styles.css';
import { makeGameConfig } from './game/config.js';
import { getStoryLevels } from './levels/index.js';

const storyLevels = getStoryLevels();

new Phaser.Game(makeGameConfig(storyLevels));

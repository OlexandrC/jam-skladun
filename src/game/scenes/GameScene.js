import Phaser from 'phaser';
import {
  DEFAULTS,
  ELEMENT_TYPES,
  GAME_AREA,
  PHYSICS,
} from '../constants.js';
import { ConfettiLauncher } from '../services/confettiLauncher.js';
import {
  getDraftShape,
  isDraftElementValid,
  makeDraftElement,
  setFormFromElement,
} from '../services/draftElements.js';
import { getElementValue } from '../services/elementCollection.js';
import {
  FACT_CARD_DATA_KEY,
  FACT_CARD_DATA_URL,
  getFactCardEntries,
  getFactCardImageAssets,
} from '../services/factCardCatalog.js';
import { getMusicTracks, getRandomMusicTrack } from '../services/musicCatalog.js';
import {
  getCollisionSoundAssets,
  getRandomCollisionSoundKey,
} from '../services/soundEffectCatalog.js';
import { getNextFactCard, setFactCardShown } from '../services/factCardStorage.js';
import { makeLevel } from '../services/levelGenerator.js';
import { GameSceneRenderer } from '../services/gameSceneRenderer.js';
import { GameSceneUiController } from '../services/gameSceneUiController.js';
import { areAllBaseShapesPlaced } from '../services/goalMatcher.js';
import { PlayerElementStore } from '../services/playerElementStore.js';
import { RunSession } from '../services/runSession.js';
import { updateScoreStats } from '../services/scoreStorage.js';
import { WinFactCard } from '../services/winFactCard.js';
import { isPointInsideShape, isShapeColliding } from '../services/shapeGeometry.js';

const MatterEvents = Phaser.Physics.Matter.Matter.Events;
const COLLISION_SOUND_COOLDOWN_MS = 80;
const MIN_COLLISION_SOUND_SPEED = 0.45;
const MAX_COLLISION_SOUND_SPEED = 6;
const MIN_COLLISION_SOUND_VOLUME = 0.08;
const MAX_COLLISION_SOUND_VOLUME = 0.75;
const WIN_SOUND_KEY = 'win-sound';
const WIN_SOUND_URL = new URL('../../assets/Win sound.ogg', import.meta.url).href;

export class GameScene extends Phaser.Scene {
  constructor(levels) {
    super('GameScene');
    this.levels = levels;
    this.selectedLevelNumber = 1;
    this.level = makeLevel(this.selectedLevelNumber);
  }

  preload() {
    this.load.json(FACT_CARD_DATA_KEY, FACT_CARD_DATA_URL);
    getFactCardImageAssets().forEach(({ key, url }) => {
      this.load.image(key, url);
    });
    getCollisionSoundAssets().forEach(({ key, url }) => {
      this.load.audio(key, url);
    });
    this.load.audio(WIN_SOUND_KEY, WIN_SOUND_URL);
  }

  create() {
    this.setInitialState();
    this.setDomElements();
    this.setGraphics();
    this.setFactCardEntries();
    this.bindCollisionSoundEvents();
    this.prepareCurrentLevelFactCard();
    this.bindUiEvents();
    this.bindPointerEvents();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  update(_time, delta) {
    if (!this.isRunning) {
      return;
    }

    this.updateRunningScene(delta);
  }

  setInitialState() {
    this.factCardEntries = [];
    this.currentFactCard = null;
    this.isRunning = false;
    this.isWinSnapshotVisible = false;
    this.isCurrentLevelFactCardAvailable = false;
    this.musicTracks = getMusicTracks();
    this.collisionSoundKeys = getCollisionSoundAssets().map(({ key }) => key);
    this.currentCollisionSoundKey = getRandomCollisionSoundKey(this.collisionSoundKeys);
    this.currentMusicTrack = null;
    this.currentMusicAudio = null;
    this.isMusicMuted = false;
    this.lastCollisionSoundTime = -Infinity;
    this.playerElementStore = new PlayerElementStore();
    this.selectedElementValue = '';
    this.highlightedElementValue = '';
    this.selectedPanelView = 'add';
    this.draggedShapeName = '';
    this.dragOffset = null;
    this.runSession = new RunSession(this.matter);
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.physicsAccumulatorMs = 0;
    this.status = `Level: ${this.level.name}`;
    this.winFactTimer = null;
  }

  setDomElements() {
    this.uiController = new GameSceneUiController(this);
    this.ui = this.uiController.ui;
    this.ui.levelSelect.value = String(this.selectedLevelNumber);
  }

  setGraphics() {
    this.renderer = new GameSceneRenderer(this);
    this.countdownText = this.makeGoalCountdownText();
    this.confettiLauncher = new ConfettiLauncher(this);
    this.winFactCard = new WinFactCard(this, () => this.clearWinFactCard());
  }

  setFactCardEntries() {
    const factGroups = this.cache.json.get(FACT_CARD_DATA_KEY);

    this.factCardEntries = getFactCardEntries(factGroups);
  }

  bindUiEvents() {
    this.uiController.bindEvents();
  }

  bindCollisionSoundEvents() {
    this.collisionStartHandler = (event) => this.handleCollisionStart(event);
    MatterEvents.on(this.matter.world.engine, 'collisionStart', this.collisionStartHandler);
  }

  toggleHighlightedElement(elementValue) {
    this.highlightedElementValue = this.highlightedElementValue === elementValue ? '' : elementValue;
    this.highlightSelectedElement();
    this.renderer.render();
  }

  getDraftInputs() {
    return this.uiController.getDraftInputs();
  }

  bindPointerEvents() {
    this.input.on('pointerdown', (pointer) => this.handlePointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => this.stopShapeDrag());
    this.input.on('pointerupoutside', () => this.stopShapeDrag());
  }

  handlePointerDown(pointer) {
    if (this.startStoredShapeDrag(pointer)) {
      return;
    }

    this.updateDraftPositionFromPointer(pointer);
  }

  handlePointerMove(pointer) {
    if (this.draggedShapeName) {
      this.updateDraggedShapePosition(pointer);
      return;
    }

    this.dragDraftPositionFromPointer(pointer);
  }

  dragDraftPositionFromPointer(pointer) {
    if (!pointer.isDown) {
      return;
    }

    this.updateDraftPositionFromPointer(pointer);
  }

  updateDraftPositionFromPointer(pointer) {
    if (this.isSceneLocked() || this.ui.elementType.value !== ELEMENT_TYPES.shape) {
      return;
    }

    this.ui.shapeX.value = Math.round(pointer.worldX);
    this.ui.shapeY.value = Math.round(pointer.worldY);
    this.updateDraftFromForm();
  }

  startStoredShapeDrag(pointer) {
    if (this.isSceneLocked()) {
      return false;
    }

    const shape = this.getPlayerShapeAtPointer(pointer);

    if (!shape) {
      return false;
    }

    this.selectElementForEditing(getElementValue(shape));
    this.highlightedElementValue = getElementValue(shape);
    this.draggedShapeName = shape.name;
    this.dragOffset = {
      x: shape.x - pointer.worldX,
      y: shape.y - pointer.worldY,
    };
    this.updateDraggedShapePosition(pointer);
    return true;
  }

  getPlayerShapeAtPointer(pointer) {
    const point = { x: pointer.worldX, y: pointer.worldY };
    const shapes = [...this.playerShapes].reverse();

    return shapes.find((shape) => isPointInsideShape(point, shape));
  }

  updateDraggedShapePosition(pointer) {
    const shape = this.getDraggedShape();

    if (!shape || !this.dragOffset) {
      this.stopShapeDrag();
      return;
    }

    const movedShape = this.getMovedDraggedShape(shape, pointer);

    if (!this.isPlayerShapePositionValid(movedShape)) {
      return;
    }

    this.setPlayerShape(movedShape);
    this.setShapePositionInputs(movedShape);
    this.updateDraftFromForm();
  }

  getDraggedShape() {
    return this.playerElementStore.getShapeByName(this.draggedShapeName);
  }

  getMovedDraggedShape(shape, pointer) {
    return {
      ...shape,
      x: Math.round(pointer.worldX + this.dragOffset.x),
      y: Math.round(pointer.worldY + this.dragOffset.y),
    };
  }

  isPlayerShapePositionValid(shape) {
    return !this.getPlayerShapeColliders(shape.name).some((collider) => {
      return isShapeColliding(shape, collider);
    });
  }

  getPlayerShapeColliders(shapeName) {
    return [
      ...this.getLevelCollisionShapes(),
      ...this.playerElementStore.getPlayerShapeColliders(shapeName),
    ];
  }

  setPlayerShape(movedShape) {
    this.playerElementStore.setShape(movedShape);
  }

  setShapePositionInputs(shape) {
    this.ui.shapeX.value = Math.round(shape.x);
    this.ui.shapeY.value = Math.round(shape.y);
  }

  stopShapeDrag() {
    this.draggedShapeName = '';
    this.dragOffset = null;
  }

  updateDraftFromForm() {
    this.updateVisibleSettings();
    this.refreshShapeReferenceSelects();
    this.draftElement = makeDraftElement(this.ui, this.elementCounters, this.getSelectedElement());
    this.draftShape = getDraftShape(this.draftElement);
    this.isDraftValid = isDraftElementValid(this.draftElement, this.draftShape, {
      collisionShapes: this.getDraftCollisionShapes(),
      playerShapes: this.playerShapes,
      gravityModifier: this.gravityModifier,
      selectedElement: this.getSelectedElement(),
    });
    this.renderer.render();
    this.updatePanel();
  }

  getDraftCollisionShapes() {
    const playerColliders = this.playerElementStore.getPlayerShapeColliders(
      this.getSelectedElementName(),
    );

    return [...this.getLevelCollisionShapes(), ...playerColliders];
  }

  addDraftElement() {
    if (this.isSceneLocked()) {
      return;
    }

    this.updateDraftFromForm();

    if (!this.isDraftValid) {
      return;
    }

    this.saveNewDraftElement();
    this.clearEditedElement();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  updateSelectedElement() {
    if (this.isSceneLocked() || !this.selectedElementValue) {
      return;
    }

    this.updateDraftFromForm();

    if (!this.isDraftValid) {
      return;
    }

    this.saveUpdatedDraftElement();
    this.clearEditedElement();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  deleteSelectedElement() {
    if (this.isSceneLocked() || !this.selectedElementValue) {
      return;
    }

    this.deleteStoredElement(this.getSelectedElement());
    this.clearEditedElement();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  cancelSelectedElementEdit() {
    if (!this.selectedElementValue) {
      return;
    }

    this.clearEditedElement();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  clearEditedElement() {
    this.selectedElementValue = '';
    this.ui.shapeSelect.value = '';
    this.ui.shapeType.value = '';
    this.clearDraftReferenceInputs();
  }

  clearDraftReferenceInputs() {
    this.ui.jointFirstShape.value = '';
    this.ui.jointSecondShape.value = '';
    this.ui.forceShape.value = '';
  }

  selectElementForEditing(elementValue) {
    this.selectedElementValue = elementValue;
    const element = this.getSelectedElement();

    if (!element) {
      this.selectedElementValue = '';
      return;
    }

    this.ui.shapeSelect.value = elementValue;
    this.ui.elementType.value = element.kind;
    setFormFromElement(this.ui, element);
    this.showPanelView('add');
    this.updateDraftFromForm();
  }

  deleteElementFromList(elementValue) {
    const element = this.getElementByValue(elementValue);

    if (!element) {
      return;
    }

    this.deleteStoredElement(element);
    this.clearSelectedElementAfterDelete(elementValue);
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  clearSelectedElementAfterDelete(elementValue) {
    if (this.selectedElementValue === elementValue) {
      this.selectedElementValue = '';
    }
  }

  selectElementType() {
    this.selectedElementValue = '';
    this.ui.shapeSelect.value = '';
    this.clearDraftReferenceInputs();
    this.updateDraftFromForm();
  }

  selectElementTypeFromTab(elementType) {
    if (this.isSceneLocked() || this.selectedElementValue) {
      return;
    }

    this.ui.elementType.value = elementType;
    this.selectElementType();
  }

  selectPlayerElement() {
    this.selectedElementValue = this.ui.shapeSelect.value;
    const element = this.getSelectedElement();

    if (!element) {
      this.updateDraftFromForm();
      return;
    }

    this.ui.elementType.value = element.kind;
    setFormFromElement(this.ui, element);
    this.updateDraftFromForm();
  }

  refreshElementSelect() {
    this.uiController.refreshElementSelect(this.getStoredElements(), this.selectedElementValue);
  }

  highlightSelectedElement() {
    this.uiController.highlightSelectedElement(this.highlightedElementValue);
  }

  updateVisibleSettings() {
    this.uiController.updateVisibleSettings();
  }

  selectDraftShapeType(shapeType) {
    if (this.isSceneLocked() || this.selectedElementValue) {
      return;
    }

    this.ui.elementType.value = ELEMENT_TYPES.shape;
    this.ui.shapeType.value = shapeType;
    this.ui.shapeX.value = Math.round(GAME_AREA.width / 2);
    this.ui.shapeY.value = Math.round(GAME_AREA.height / 2);
    this.updateDraftFromForm();
  }

  clearDraftShapeType() {
    if (this.isSceneLocked() || this.selectedElementValue) {
      return;
    }

    this.ui.shapeType.value = '';
    this.updateDraftFromForm();
  }

  showPanelView(panelView) {
    this.selectedPanelView = panelView;
    this.uiController.updatePanelViews();
  }

  selectPanelViewFromTab(panelView) {
    this.showPanelView(panelView);

    if (panelView !== 'add') {
      return;
    }

    this.cancelSelectedElementEdit();
  }

  refreshShapeReferenceSelects() {
    const shapeNames = this.playerElementStore.getShapeNames();

    this.uiController.refreshShapeReferenceSelects(shapeNames);
  }

  saveNewDraftElement() {
    this.playerElementStore.addDraftElement(this.draftElement);
  }

  saveUpdatedDraftElement() {
    this.playerElementStore.updateDraftElement(this.draftElement);
  }

  deleteStoredElement(element) {
    this.playerElementStore.deleteElement(element);
  }

  getSelectedElement() {
    return this.getElementByValue(this.selectedElementValue);
  }

  getElementByValue(elementValue) {
    return this.playerElementStore.getElementByValue(elementValue);
  }

  getSelectedElementName() {
    return this.getSelectedElement()?.name ?? '';
  }

  getStoredElements() {
    return this.playerElementStore.getElements();
  }

  startRun() {
    if (this.isRunning) {
      return;
    }

    this.stopShapeDrag();
    this.clearWinFactCard();

    if (this.isWinSnapshotVisible) {
      this.clearRunBodies();
    }

    this.confettiLauncher.clear();
    this.isWinSnapshotVisible = false;
    this.matter.world.resume();
    this.isRunning = true;
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.physicsAccumulatorMs = 0;
    this.status = 'Physics running';
    this.setRunGravity();
    this.createRunBodies();
    this.updatePanel();
  }

  stopRun(status) {
    if (!this.canStopRun()) {
      return;
    }

    if (this.isWinSnapshotVisible) {
      this.clearWinSnapshot(status);
      return;
    }

    this.finishRun(status, false);
  }

  resetLevel() {
    this.isRunning = false;
    this.isWinSnapshotVisible = false;
    this.stopShapeDrag();
    this.resetCollisionSoundState();
    this.matter.world.resume();
    this.clearRunBodies();
    this.playerElementStore.reset();
    this.selectedElementValue = '';
    this.highlightedElementValue = '';
    this.selectedPanelView = 'add';
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.physicsAccumulatorMs = 0;
    this.status = `Level: ${this.level.name}`;
    this.ui.levelSelect.value = String(this.selectedLevelNumber);
    this.matter.world.setGravity(0, 0, this.getGravityScale());
    this.hideGoalCountdown();
    this.confettiLauncher.clear();
    this.clearWinFactCard();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  selectLevel() {
    if (this.isRunning) {
      this.ui.levelSelect.value = String(this.selectedLevelNumber);
      return;
    }

    this.status = this.getLevelSelectionStatus();
    this.updatePanel();
  }

  generateSelectedLevel() {
    if (this.isRunning) {
      return;
    }

    this.selectedLevelNumber = this.getSelectedLevelInput();
    this.level = makeLevel(this.selectedLevelNumber);
    this.setCollisionSoundForLevel();
    this.prepareCurrentLevelFactCard();
    this.playRandomLevelTrack();
    this.resetLevel();
  }

  toggleMusicPlayback() {
    if (!this.hasSelectedMusicTrack()) {
      return;
    }

    this.isMusicMuted = !this.isMusicMuted;
    this.restartCurrentMusic();
    this.updatePanel();
  }

  playRandomLevelTrack() {
    const track = getRandomMusicTrack(this.musicTracks, this.getCurrentMusicTrackKey());

    if (!track) {
      return;
    }

    this.currentMusicTrack = track;
    this.restartCurrentMusic();
  }

  restartCurrentMusic() {
    this.stopCurrentMusic();

    if (this.isMusicMuted || !this.currentMusicTrack) {
      return;
    }

    const musicAudio = makeLoopedMusicAudio(this.currentMusicTrack.url);

    this.currentMusicAudio = musicAudio;
    musicAudio.play().catch(() => {
      if (this.currentMusicAudio !== musicAudio) {
        return;
      }

      this.stopCurrentMusic();
      this.updatePanel();
    });
  }

  stopCurrentMusic() {
    if (!this.currentMusicAudio) {
      return;
    }

    this.currentMusicAudio.pause();
    this.currentMusicAudio.currentTime = 0;
    this.currentMusicAudio.src = '';
    this.currentMusicAudio.load();
    this.currentMusicAudio = null;
  }

  hasSelectedMusicTrack() {
    return Boolean(this.currentMusicTrack);
  }

  getCurrentMusicTrackKey() {
    return this.currentMusicTrack?.key ?? '';
  }

  getLevelSelectionStatus() {
    if (!this.hasPendingLevel()) {
      return `Level: ${this.level.name}`;
    }

    return `Level ${this.getSelectedLevelInput()} selected. Generate level to apply.`;
  }

  getSelectedLevelInput() {
    return Number(this.ui.levelSelect.value);
  }

  hasPendingLevel() {
    return this.getSelectedLevelInput() !== this.selectedLevelNumber;
  }

  finishRun(status, isWin) {
    this.isRunning = false;
    this.isWinSnapshotVisible = isWin;
    this.stopShapeDrag();
    this.resetCollisionSoundState();
    this.status = status;
    this.physicsAccumulatorMs = 0;
    this.matter.world.setGravity(0, 0, this.getGravityScale());
    this.hideGoalCountdown();
    this.clearWinFactCard();

    if (isWin) {
      this.matter.world.pause();
      updateScoreStats(this.getScore());
    } else {
      this.clearRunBodies();
    }

    this.renderer.render();
    this.updatePanel();

    if (isWin) {
      this.playWinSound();
      this.confettiLauncher.play();
      this.scheduleWinFactCard();
    }
  }

  clearWinSnapshot(status) {
    this.isWinSnapshotVisible = false;
    this.stopShapeDrag();
    this.resetCollisionSoundState();
    this.status = status;
    this.physicsAccumulatorMs = 0;
    this.matter.world.resume();
    this.clearRunBodies();
    this.hideGoalCountdown();
    this.confettiLauncher.clear();
    this.clearWinFactCard();
    this.renderer.render();
    this.updatePanel();
  }

  scheduleWinFactCard() {
    if (!this.canShowCurrentLevelFactCard()) {
      return;
    }

    this.isCurrentLevelFactCardAvailable = false;
    this.winFactTimer = this.time.delayedCall(
      this.confettiLauncher.getDisplayDuration(),
      () => this.showWinFactCard(),
    );
  }

  showWinFactCard() {
    this.winFactTimer = null;

    if (!this.isWinSnapshotVisible || !this.currentFactCard) {
      return;
    }

    setFactCardShown(this.factCardEntries, this.currentFactCard.id);
    this.winFactCard.show(this.currentFactCard);
  }

  clearWinFactCard() {
    this.clearPendingWinFactCard();
    this.winFactCard.hide();
  }

  clearPendingWinFactCard() {
    if (!this.winFactTimer) {
      return;
    }

    this.time.removeEvent(this.winFactTimer);
    this.winFactTimer = null;
  }

  prepareCurrentLevelFactCard() {
    this.currentFactCard = getNextFactCard(this.factCardEntries);
    this.isCurrentLevelFactCardAvailable = Boolean(this.currentFactCard);
  }

  canShowCurrentLevelFactCard() {
    return Boolean(this.currentFactCard) && this.isCurrentLevelFactCardAvailable;
  }

  setRunGravity() {
    const gravity = this.level.gravity ?? {};
    const gravityX = (gravity.x ?? DEFAULTS.gravityX) + (this.gravityModifier?.x ?? 0);
    const gravityY = (gravity.y ?? DEFAULTS.gravityY) + (this.gravityModifier?.y ?? 0);

    this.matter.world.setGravity(gravityX, gravityY, this.getGravityScale());
  }

  getVisibleGravity() {
    const gravity = this.level.gravity ?? {};
    const modifier = this.getVisibleGravityModifier();

    return {
      x: (gravity.x ?? DEFAULTS.gravityX) + (modifier?.x ?? 0),
      y: (gravity.y ?? DEFAULTS.gravityY) + (modifier?.y ?? 0),
    };
  }

  getVisibleGravityModifier() {
    if (this.isSceneLocked()) {
      return this.gravityModifier;
    }

    if (this.draftElement?.kind !== ELEMENT_TYPES.gravity) {
      return this.gravityModifier;
    }

    if (!this.gravityModifier || this.getSelectedElement()?.kind === ELEMENT_TYPES.gravity) {
      return this.draftElement;
    }

    return this.gravityModifier;
  }

  getGravityScale() {
    return PHYSICS.gravityScale * PHYSICS.gravityCoefficient;
  }

  createRunBodies() {
    this.runSession.start(this.level, this.playerShapes, this.playerJoints);
  }

  clearRunBodies() {
    this.runSession.clear();
  }

  updateRunningScene(deltaMilliseconds) {
    this.physicsAccumulatorMs = this.getNextPhysicsAccumulator(deltaMilliseconds);

    let stepCount = 0;

    while (
      this.isRunning
      && this.physicsAccumulatorMs >= this.getFixedStepMilliseconds()
      && stepCount < PHYSICS.maxSubSteps
    ) {
      this.runFixedStep();
      this.physicsAccumulatorMs -= this.getFixedStepMilliseconds();
      stepCount += 1;
    }

    if (!this.isRunning) {
      return;
    }

    this.renderer.render();
    this.updatePanel();
  }

  handleCollisionStart(event) {
    if (!this.isRunning || !this.canPlayCollisionSound()) {
      return;
    }

    const soundVolume = this.getStrongestCollisionSoundVolume(event.pairs);

    if (soundVolume <= 0) {
      return;
    }

    this.playCollisionSound(soundVolume);
  }

  canPlayCollisionSound() {
    return Boolean(this.currentCollisionSoundKey)
      && this.time.now - this.lastCollisionSoundTime >= COLLISION_SOUND_COOLDOWN_MS;
  }

  getStrongestCollisionSoundVolume(pairs) {
    let strongestVolume = 0;

    pairs.forEach((pair) => {
      const volume = this.getCollisionSoundVolume(pair);

      if (volume > strongestVolume) {
        strongestVolume = volume;
      }
    });

    return strongestVolume;
  }

  getCollisionSoundVolume(pair) {
    const bodyA = pair.bodyA?.parent ?? pair.bodyA;
    const bodyB = pair.bodyB?.parent ?? pair.bodyB;
    const recordA = this.runSession.getBodyRecordByBody(bodyA);
    const recordB = this.runSession.getBodyRecordByBody(bodyB);

    if (!recordA?.active || !recordB?.active) {
      return 0;
    }

    return getCollisionSoundVolumeFromSpeed(getImpactSpeed(bodyA, bodyB));
  }

  playCollisionSound(volume) {
    if (!this.currentCollisionSoundKey) {
      return;
    }

    this.lastCollisionSoundTime = this.time.now;
    this.sound.play(this.currentCollisionSoundKey, { volume });
  }

  playWinSound() {
    this.sound.stopByKey(WIN_SOUND_KEY);
    this.sound.play(WIN_SOUND_KEY);
  }

  resetCollisionSoundState() {
    this.lastCollisionSoundTime = -Infinity;
  }

  setCollisionSoundForLevel() {
    this.currentCollisionSoundKey = getRandomCollisionSoundKey(
      this.collisionSoundKeys,
      this.currentCollisionSoundKey,
    );
  }

  getNextPhysicsAccumulator(deltaMilliseconds) {
    const clampedDelta = Math.min(deltaMilliseconds, PHYSICS.maxFrameDeltaMs);
    const nextAccumulator = this.physicsAccumulatorMs + clampedDelta;

    return Math.min(nextAccumulator, this.getMaxPhysicsAccumulator());
  }

  getMaxPhysicsAccumulator() {
    return this.getFixedStepMilliseconds() * PHYSICS.maxSubSteps;
  }

  getFixedStepMilliseconds() {
    return PHYSICS.fixedStepMs;
  }

  getFixedStepSeconds() {
    return this.getFixedStepMilliseconds() / 1000;
  }

  runFixedStep() {
    const stepMilliseconds = this.getFixedStepMilliseconds();
    const stepSeconds = this.getFixedStepSeconds();

    this.elapsedSeconds += stepSeconds;
    this.runSession.step(this.elapsedSeconds, this.playerForces, stepMilliseconds);
    this.updateWinProgress(stepSeconds);
    this.updateTimeLimit();
  }

  getRunBodyRecordByName(name) {
    return this.runSession.getBodyRecordByName(name);
  }

  updateWinProgress(deltaSeconds) {
    const baseShapes = this.getActiveBaseShapes();

    if (baseShapes.length !== this.level.baseShapes.length) {
      this.heldSeconds = 0;
      this.hideGoalCountdown();
      return;
    }

    if (!areAllBaseShapesPlaced(baseShapes, this.level.goals, this.getTolerance())) {
      this.heldSeconds = 0;
      this.hideGoalCountdown();
      return;
    }

    this.heldSeconds += deltaSeconds;
    this.showGoalCountdown();

    if (this.heldSeconds >= this.getRequiredHoldSeconds()) {
      this.finishRun('Level complete', true);
    }
  }

  getActiveBaseShapes() {
    return this.runSession.getActiveBaseShapes();
  }

  updateTimeLimit() {
    const timeLimit = this.level.timeLimitSeconds;

    if (!timeLimit || this.elapsedSeconds < timeLimit || !this.isRunning) {
      return;
    }

    this.finishRun('Level time is over', false);
  }

  makeGoalCountdownText() {
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, '', {
      color: '#a2ecd3',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '220px',
      fontStyle: '800',
      stroke: '#1B2130',
      strokeThickness: 12,
    });

    text.setOrigin(0.5);
    text.setAlpha(0.86);
    text.setDepth(1000);
    text.setVisible(false);
    return text;
  }

  showGoalCountdown() {
    const remainingSeconds = Math.max(0, this.getRequiredHoldSeconds() - this.heldSeconds);
    const roundedSeconds = Math.ceil(remainingSeconds * 10) / 10;

    this.countdownText.setText(roundedSeconds.toFixed(1));
    this.countdownText.setVisible(true);
  }

  hideGoalCountdown() {
    this.countdownText.setVisible(false);
  }

  updatePanel() {
    this.uiController.updatePanel();
  }

  canStopRun() {
    return this.isRunning || this.isWinSnapshotVisible;
  }

  isSceneLocked() {
    return this.isRunning || this.isWinSnapshotVisible;
  }

  get playerShapes() {
    return this.playerElementStore.playerShapes;
  }

  get playerJoints() {
    return this.playerElementStore.playerJoints;
  }

  get playerForces() {
    return this.playerElementStore.playerForces;
  }

  get gravityModifier() {
    return this.playerElementStore.gravityModifier;
  }

  get elementCounters() {
    return this.playerElementStore.elementCounters;
  }

  get runBodies() {
    return this.runSession.runBodies;
  }

  getScore() {
    return this.playerElementStore.getScore();
  }

  getLevelShapes(key) {
    return this.level[key] ?? [];
  }

  getLevelCollisionShapes() {
    return [
      ...this.getLevelShapes('walls'),
      ...this.getLevelShapes('baseShapes'),
      ...this.getLevelShapes('obstacles'),
    ];
  }

  getTolerance() {
    return this.level.tolerance ?? DEFAULTS.tolerance;
  }

  getRequiredHoldSeconds() {
    return this.level.requiredHoldSeconds ?? DEFAULTS.requiredHoldSeconds;
  }
}

function makeLoopedMusicAudio(url) {
  const audio = new Audio(url);

  audio.loop = true;
  audio.preload = 'auto';
  return audio;
}

function getImpactSpeed(bodyA, bodyB) {
  const velocityX = (bodyA?.velocity?.x ?? 0) - (bodyB?.velocity?.x ?? 0);
  const velocityY = (bodyA?.velocity?.y ?? 0) - (bodyB?.velocity?.y ?? 0);

  return Math.hypot(velocityX, velocityY);
}

function getCollisionSoundVolumeFromSpeed(speed) {
  if (speed < MIN_COLLISION_SOUND_SPEED) {
    return 0;
  }

  const normalizedSpeed = Phaser.Math.Clamp(
    (speed - MIN_COLLISION_SOUND_SPEED) / (MAX_COLLISION_SOUND_SPEED - MIN_COLLISION_SOUND_SPEED),
    0,
    1,
  );

  return MIN_COLLISION_SOUND_VOLUME
    + Math.sqrt(normalizedSpeed) * (MAX_COLLISION_SOUND_VOLUME - MIN_COLLISION_SOUND_VOLUME);
}

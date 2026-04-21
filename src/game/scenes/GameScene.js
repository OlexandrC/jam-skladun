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
import { GameSceneRenderer } from '../services/gameSceneRenderer.js';
import { GameSceneUiController } from '../services/gameSceneUiController.js';
import { areAllBaseShapesPlaced } from '../services/goalMatcher.js';
import { PlayerElementStore } from '../services/playerElementStore.js';
import { RunSession } from '../services/runSession.js';
import { updateScoreStats } from '../services/scoreStorage.js';
import { isPointInsideShape, isShapeColliding } from '../services/shapeGeometry.js';

export class GameScene extends Phaser.Scene {
  constructor(levels) {
    super('GameScene');
    this.levels = levels;
    this.level = levels[0];
  }

  create() {
    this.setInitialState();
    this.setDomElements();
    this.setGraphics();
    this.bindUiEvents();
    this.bindPointerEvents();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  update(_time, delta) {
    if (!this.isRunning) {
      return;
    }

    this.updateRunningScene(delta / 1000);
  }

  setInitialState() {
    this.isRunning = false;
    this.isWinSnapshotVisible = false;
    this.playerElementStore = new PlayerElementStore();
    this.selectedElementValue = '';
    this.highlightedElementValue = '';
    this.selectedPanelView = 'add';
    this.draggedShapeName = '';
    this.dragOffset = null;
    this.runSession = new RunSession(this.matter);
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.status = `Level: ${this.level.name}`;
  }

  setDomElements() {
    this.uiController = new GameSceneUiController(this);
    this.ui = this.uiController.ui;
  }

  setGraphics() {
    this.renderer = new GameSceneRenderer(this);
    this.countdownText = this.makeGoalCountdownText();
    this.confettiLauncher = new ConfettiLauncher(this);
  }

  bindUiEvents() {
    this.uiController.bindEvents();
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
    this.confettiLauncher.clear();
    this.isWinSnapshotVisible = false;
    this.matter.world.resume();
    this.isRunning = true;
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.status = 'Physics running';
    this.setRunGravity();
    this.createRunBodies();
    this.updatePanel();
  }

  stopRun(status) {
    if (!this.isRunning) {
      return;
    }

    this.finishRun(status, false);
  }

  resetLevel() {
    this.isRunning = false;
    this.isWinSnapshotVisible = false;
    this.stopShapeDrag();
    this.matter.world.resume();
    this.clearRunBodies();
    this.playerElementStore.reset();
    this.selectedElementValue = '';
    this.highlightedElementValue = '';
    this.selectedPanelView = 'add';
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.status = `Level: ${this.level.name}`;
    this.matter.world.setGravity(0, 0, this.getGravityScale());
    this.hideGoalCountdown();
    this.confettiLauncher.clear();
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  finishRun(status, isWin) {
    this.isRunning = false;
    this.isWinSnapshotVisible = isWin;
    this.stopShapeDrag();
    this.status = status;
    this.matter.world.setGravity(0, 0, this.getGravityScale());
    this.hideGoalCountdown();

    if (isWin) {
      this.matter.world.pause();
      updateScoreStats(this.getScore());
    } else {
      this.clearRunBodies();
    }

    this.renderer.render();
    this.updatePanel();

    if (isWin) {
      this.confettiLauncher.play();
    }
  }

  setRunGravity() {
    const gravity = this.level.gravity ?? {};
    const gravityX = (gravity.x ?? DEFAULTS.gravityX) + (this.gravityModifier?.x ?? 0);
    const gravityY = (gravity.y ?? DEFAULTS.gravityY) + (this.gravityModifier?.y ?? 0);

    this.matter.world.setGravity(gravityX, gravityY, this.getGravityScale());
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

  updateRunningScene(deltaSeconds) {
    this.elapsedSeconds += deltaSeconds;
    this.runSession.update(this.elapsedSeconds, this.playerForces);
    this.updateWinProgress(deltaSeconds);
    this.updateTimeLimit();
    this.renderer.render();
    this.updatePanel();
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

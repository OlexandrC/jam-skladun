import Phaser from 'phaser';
import {
  DEFAULTS,
  ELEMENT_TYPES,
  PHYSICS,
  UI_IDS,
} from '../constants.js';
import { ConfettiLauncher } from '../services/confettiLauncher.js';
import {
  getDraftShape,
  isDraftElementValid,
  makeDraftElement,
  setFormFromElement,
} from '../services/draftElements.js';
import {
  getElementByValue,
  getElementValue,
  getScore,
  getStoredElements,
} from '../services/elementCollection.js';
import { makeSelectOption, renderElementList } from '../services/elementDom.js';
import { GameSceneRenderer } from '../services/gameSceneRenderer.js';
import { areAllBaseShapesPlaced } from '../services/goalMatcher.js';
import {
  createMatterBody,
  getBodyRecordName,
  getForceVector,
  getShapeFromBodyRecord,
  isBodyOutsideWorld,
  isForceActive,
} from '../services/runPhysics.js';
import { updateScoreStats } from '../services/scoreStorage.js';
import {
  getDraftErrorText,
  getElementNote,
  getStatsText,
  getTimerText,
} from '../services/uiText.js';

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
    this.playerShapes = [];
    this.playerJoints = [];
    this.playerForces = [];
    this.gravityModifier = null;
    this.elementCounters = { circle: 0, rectangle: 0, triangle: 0, joint: 0, force: 0 };
    this.selectedElementValue = '';
    this.selectedPanelView = 'add';
    this.runBodies = [];
    this.runConstraints = [];
    this.baseBodyRecords = [];
    this.elapsedSeconds = 0;
    this.heldSeconds = 0;
    this.status = `Level: ${this.level.name}`;
  }

  setDomElements() {
    this.ui = Object.entries(UI_IDS).reduce((elements, [key, id]) => {
      const element = document.getElementById(id);

      if (!element) {
        throw new Error(`[GAMESCENE-001] Missing UI element: ${id}`);
      }

      return { ...elements, [key]: element };
    }, {});
  }

  setGraphics() {
    this.renderer = new GameSceneRenderer(this);
    this.elementSettings = document.querySelectorAll('[data-element-settings]');
    this.elementTypeTabs = document.querySelectorAll('[data-element-type-tab]');
    this.shapeTypeButtons = document.querySelectorAll('[data-shape-type-button]');
    this.clearShapeTypeButton = document.querySelector('[data-shape-type-clear]');
    this.panelViews = document.querySelectorAll('[data-panel-view]');
    this.panelTabs = document.querySelectorAll('[data-panel-tab]');
    this.countdownText = this.makeGoalCountdownText();
    this.confettiLauncher = new ConfettiLauncher(this);
  }

  bindUiEvents() {
    this.ui.elementType.addEventListener('change', () => this.selectElementType());
    this.bindPanelTabEvents();
    this.bindElementTypeTabEvents();
    this.bindShapeTypeButtonEvents();
    this.bindElementListEvents();
    this.ui.shapeSelect.addEventListener('change', () => this.selectPlayerElement());
    this.bindDraftInputEvents();
    this.ui.addShape.addEventListener('click', () => this.addDraftElement());
    this.ui.updateShape.addEventListener('click', () => this.updateSelectedElement());
    this.ui.deleteShape.addEventListener('click', () => this.deleteSelectedElement());
    this.ui.playButton.addEventListener('click', () => this.startRun());
    this.ui.stopButton.addEventListener('click', () => this.stopRun('Scene stopped'));
    this.ui.resetButton.addEventListener('click', () => this.resetLevel());
  }

  bindPanelTabEvents() {
    this.panelTabs.forEach((tab) => {
      tab.addEventListener('click', () => this.showPanelView(tab.dataset.panelTab));
    });
  }

  bindElementTypeTabEvents() {
    this.elementTypeTabs.forEach((tab) => {
      tab.addEventListener('click', () => this.selectElementTypeFromTab(tab.dataset.elementTypeTab));
    });
  }

  bindShapeTypeButtonEvents() {
    this.shapeTypeButtons.forEach((button) => {
      button.addEventListener('click', () => this.selectDraftShapeType(button.dataset.shapeTypeButton));
    });
    this.clearShapeTypeButton.addEventListener('click', () => this.clearDraftShapeType());
  }

  bindElementListEvents() {
    this.ui.elementList.addEventListener('click', (event) => {
      this.handleElementListClick(event.target.closest('button'));
    });
  }

  handleElementListClick(button) {
    if (!button || this.isSceneLocked()) {
      return;
    }

    if (button.dataset.elementEdit) {
      this.selectElementForEditing(button.dataset.elementEdit);
      return;
    }

    if (button.dataset.elementDelete) {
      this.deleteElementFromList(button.dataset.elementDelete);
    }
  }

  bindDraftInputEvents() {
    this.getDraftInputs().forEach((input) => {
      input.addEventListener('input', () => this.updateDraftFromForm());
      input.addEventListener('change', () => this.updateDraftFromForm());
    });
  }

  getDraftInputs() {
    return [
      this.ui.shapeType,
      this.ui.shapeX,
      this.ui.shapeY,
      this.ui.shapeSize,
      this.ui.shapeMass,
      this.ui.jointFirstShape,
      this.ui.jointSecondShape,
      this.ui.jointStrength,
      this.ui.jointDistance,
      this.ui.forceShape,
      this.ui.forceStrength,
      this.ui.forceDirectionX,
      this.ui.forceDirectionY,
      this.ui.forceStart,
      this.ui.forceEnd,
      this.ui.gravityX,
      this.ui.gravityY,
    ];
  }

  bindPointerEvents() {
    this.input.on('pointerdown', (pointer) => this.updateDraftPositionFromPointer(pointer));
    this.input.on('pointermove', (pointer) => this.dragDraftPositionFromPointer(pointer));
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
    const levelColliders = [
      ...this.getLevelShapes('walls'),
      ...this.getLevelShapes('baseShapes'),
      ...this.getLevelShapes('obstacles'),
    ];
    const playerColliders = this.playerShapes.filter((shape) => {
      return shape.name !== this.getSelectedElementName();
    });

    return [...levelColliders, ...playerColliders];
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
    this.selectedElementValue = '';
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
    this.selectedElementValue = '';
    this.refreshElementSelect();
    this.updateDraftFromForm();
  }

  deleteSelectedElement() {
    if (this.isSceneLocked() || !this.selectedElementValue) {
      return;
    }

    this.deleteStoredElement(this.getSelectedElement());
    this.selectedElementValue = '';
    this.refreshElementSelect();
    this.updateDraftFromForm();
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
    const options = [makeSelectOption('', 'New element')];
    const elementOptions = this.getStoredElements().map((element) => {
      return makeSelectOption(getElementValue(element), element.name);
    });

    this.ui.shapeSelect.replaceChildren(...options, ...elementOptions);
    this.ui.shapeSelect.value = this.selectedElementValue;
    this.renderElementList();
  }

  renderElementList() {
    renderElementList(this.ui.elementList, this.getStoredElements(), getElementValue);
  }

  updateVisibleSettings() {
    this.elementSettings.forEach((section) => {
      section.hidden = section.dataset.elementSettings !== this.ui.elementType.value;
    });
    this.updatePanelViews();
    this.updateElementTypeTabs();
    this.updateShapeTypeButtons();
  }

  selectDraftShapeType(shapeType) {
    if (this.isSceneLocked() || this.selectedElementValue) {
      return;
    }

    this.ui.elementType.value = ELEMENT_TYPES.shape;
    this.ui.shapeType.value = shapeType;
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
    this.updatePanelViews();
  }

  updatePanelViews() {
    this.panelViews.forEach((view) => {
      view.hidden = view.dataset.panelView !== this.selectedPanelView;
    });
    this.updatePanelTabs();
  }

  updatePanelTabs() {
    this.panelTabs.forEach((tab) => {
      const isActive = tab.dataset.panelTab === this.selectedPanelView;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  }

  updateElementTypeTabs() {
    this.elementTypeTabs.forEach((tab) => {
      const isActive = tab.dataset.elementTypeTab === this.ui.elementType.value;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
  }

  updateShapeTypeButtons() {
    this.shapeTypeButtons.forEach((button) => {
      const isActive = button.dataset.shapeTypeButton === this.ui.shapeType.value;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  refreshShapeReferenceSelects() {
    const shapeNames = this.playerShapes.map((shape) => shape.name);

    this.refreshReferenceSelect(this.ui.jointFirstShape, shapeNames);
    this.refreshReferenceSelect(this.ui.jointSecondShape, shapeNames);
    this.refreshReferenceSelect(this.ui.forceShape, shapeNames);
  }

  refreshReferenceSelect(select, values) {
    const selectedValue = select.value;
    const options = values.map((value) => makeSelectOption(value, value));

    if (options.length === 0) {
      options.push(makeSelectOption('', 'No shapes'));
    }

    select.replaceChildren(...options);
    select.value = values.includes(selectedValue) ? selectedValue : values[0] ?? '';
  }

  saveNewDraftElement() {
    if (this.draftElement.kind === ELEMENT_TYPES.shape) {
      this.playerShapes.push({ ...this.draftElement });
      this.elementCounters[this.draftElement.shape] += 1;
      return;
    }

    this.saveNewNonShapeDraftElement();
  }

  saveNewNonShapeDraftElement() {
    if (this.draftElement.kind === ELEMENT_TYPES.joint) {
      this.playerJoints.push({ ...this.draftElement });
      this.elementCounters.joint += 1;
      return;
    }

    if (this.draftElement.kind === ELEMENT_TYPES.force) {
      this.playerForces.push({ ...this.draftElement });
      this.elementCounters.force += 1;
      return;
    }

    this.gravityModifier = { ...this.draftElement };
  }

  saveUpdatedDraftElement() {
    if (this.draftElement.kind === ELEMENT_TYPES.shape) {
      this.updateStoredShape();
      return;
    }

    if (this.draftElement.kind === ELEMENT_TYPES.joint) {
      this.updateStoredJoint();
      return;
    }

    if (this.draftElement.kind === ELEMENT_TYPES.force) {
      this.updateStoredForce();
      return;
    }

    this.gravityModifier = { ...this.draftElement };
  }

  updateStoredShape() {
    this.playerShapes = this.playerShapes.map((shape) => {
      return shape.name === this.draftElement.name ? { ...this.draftElement } : shape;
    });
  }

  updateStoredJoint() {
    this.playerJoints = this.playerJoints.map((joint) => {
      return joint.name === this.draftElement.name ? { ...this.draftElement } : joint;
    });
  }

  updateStoredForce() {
    this.playerForces = this.playerForces.map((force) => {
      return force.name === this.draftElement.name ? { ...this.draftElement } : force;
    });
  }

  deleteStoredElement(element) {
    if (!element) {
      return;
    }

    if (element.kind === ELEMENT_TYPES.shape) {
      this.deleteStoredShape(element.name);
      return;
    }

    this.deleteStoredNonShapeElement(element);
  }

  deleteStoredShape(shapeName) {
    this.playerShapes = this.playerShapes.filter((shape) => shape.name !== shapeName);
    this.playerJoints = this.playerJoints.filter((joint) => {
      return joint.firstShapeName !== shapeName && joint.secondShapeName !== shapeName;
    });
    this.playerForces = this.playerForces.filter((force) => force.shapeName !== shapeName);
  }

  deleteStoredNonShapeElement(element) {
    if (element.kind === ELEMENT_TYPES.joint) {
      this.playerJoints = this.playerJoints.filter((joint) => joint.name !== element.name);
      return;
    }

    if (element.kind === ELEMENT_TYPES.force) {
      this.playerForces = this.playerForces.filter((force) => force.name !== element.name);
      return;
    }

    this.gravityModifier = null;
  }

  getSelectedElement() {
    return this.getElementByValue(this.selectedElementValue);
  }

  getElementByValue(elementValue) {
    return getElementByValue(this.getStoredElements(), elementValue);
  }

  getSelectedElementName() {
    return this.getSelectedElement()?.name ?? '';
  }

  getStoredElements() {
    return getStoredElements(
      this.playerShapes,
      this.playerJoints,
      this.playerForces,
      this.gravityModifier,
    );
  }

  startRun() {
    if (this.isRunning) {
      return;
    }

    this.confettiLauncher.clear();
    this.isWinSnapshotVisible = false;
    this.matter.world.resume();
    this.clearRunBodies();
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
    this.matter.world.resume();
    this.clearRunBodies();
    this.playerShapes = [];
    this.playerJoints = [];
    this.playerForces = [];
    this.gravityModifier = null;
    this.elementCounters = { circle: 0, rectangle: 0, triangle: 0, joint: 0, force: 0 };
    this.selectedElementValue = '';
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
    this.getLevelShapes('walls').forEach((shape) => this.addBodyRecord(shape, 'wall', true));
    this.getLevelShapes('obstacles').forEach((shape) => this.addBodyRecord(shape, 'obstacle', shape.isStatic));
    this.level.baseShapes.forEach((shape) => this.addBodyRecord(shape, 'base', false));
    this.playerShapes.forEach((shape) => this.addBodyRecord(shape, 'player', false));
    this.baseBodyRecords = this.runBodies.filter((record) => record.kind === 'base');
    this.createRunConstraints();
  }

  addBodyRecord(shape, kind, isStatic) {
    const body = createMatterBody(this.matter, shape, Boolean(isStatic));
    const record = {
      body,
      shape,
      kind,
      active: true,
    };

    this.runBodies.push(record);
  }

  clearRunBodies() {
    this.runConstraints.forEach((record) => {
      this.matter.world.remove(record.constraint);
    });
    this.runBodies.forEach((record) => {
      this.matter.world.remove(record.body);
    });
    this.runBodies = [];
    this.runConstraints = [];
    this.baseBodyRecords = [];
  }

  updateRunningScene(deltaSeconds) {
    this.elapsedSeconds += deltaSeconds;
    this.clearBodiesOutsideWorld();
    this.clearInactiveRunConstraints();
    this.applyActiveForces();
    this.updateWinProgress(deltaSeconds);
    this.updateTimeLimit();
    this.renderer.render();
    this.updatePanel();
  }

  createRunConstraints() {
    this.playerJoints.forEach((joint) => {
      const firstRecord = this.getRunBodyRecordByName(joint.firstShapeName);
      const secondRecord = this.getRunBodyRecordByName(joint.secondShapeName);

      if (!firstRecord || !secondRecord) {
        return;
      }

      this.addRunConstraint(joint, firstRecord.body, secondRecord.body);
    });
  }

  addRunConstraint(joint, firstBody, secondBody) {
    const constraint = this.matter.add.constraint(
      firstBody,
      secondBody,
      joint.distance,
      joint.strength,
      { label: joint.name },
    );

    this.runConstraints.push({ constraint, joint });
  }

  applyActiveForces() {
    this.playerForces.forEach((force) => {
      if (!isForceActive(force, this.elapsedSeconds)) {
        return;
      }

      this.applyForceToBody(force);
    });
  }

  applyForceToBody(force) {
    const record = this.getRunBodyRecordByName(force.shapeName);

    if (!record?.active) {
      return;
    }

    Phaser.Physics.Matter.Matter.Body.applyForce(
      record.body,
      record.body.position,
      getForceVector(force),
    );
  }

  getRunBodyRecordByName(name) {
    return this.runBodies.find((record) => {
      return getBodyRecordName(record) === name;
    });
  }

  clearBodiesOutsideWorld() {
    this.runBodies.forEach((record) => {
      if (!record.active || !isBodyOutsideWorld(record.body)) {
        return;
      }

      record.active = false;
      this.matter.world.remove(record.body);
    });
  }

  clearInactiveRunConstraints() {
    this.runConstraints = this.runConstraints.filter((record) => {
      if (this.isConstraintActive(record.constraint)) {
        return true;
      }

      this.matter.world.remove(record.constraint);
      return false;
    });
  }

  isConstraintActive(constraint) {
    return this.isRunBodyActive(constraint.bodyA) && this.isRunBodyActive(constraint.bodyB);
  }

  isRunBodyActive(body) {
    return this.runBodies.some((record) => {
      return record.active && record.body === body;
    });
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
    return this.baseBodyRecords
      .filter((record) => record.active)
      .map((record) => getShapeFromBodyRecord(record));
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
    this.ui.elementNote.textContent = getElementNote(this.ui.elementType.value);
    this.ui.statusText.textContent = this.getStatusText();
    this.ui.scoreText.textContent = `Score: ${this.getScore()}`;
    this.ui.timerText.textContent = getTimerText(
      this.elapsedSeconds,
      this.heldSeconds,
      this.getRequiredHoldSeconds(),
    );
    this.ui.statsText.textContent = getStatsText();
    this.updateButtonStates();
  }

  getStatusText() {
    if (!this.isDraftValid && !this.isSceneLocked()) {
      return `${this.status}. ${getDraftErrorText(this.draftElement)}`;
    }

    return this.status;
  }

  updateButtonStates() {
    const hasSelectedElement = Boolean(this.selectedElementValue);
    const isLocked = this.isSceneLocked();

    this.ui.shapeSelect.disabled = isLocked;
    this.ui.elementType.disabled = isLocked || hasSelectedElement;
    this.elementTypeTabs.forEach((tab) => {
      tab.disabled = isLocked || hasSelectedElement;
    });
    this.getDraftInputs().forEach((input) => {
      input.disabled = isLocked;
    });
    this.ui.shapeType.disabled = isLocked || hasSelectedElement;
    this.ui.addShape.disabled = isLocked || !this.isDraftValid || hasSelectedElement;
    this.ui.updateShape.disabled = isLocked || !hasSelectedElement || !this.isDraftValid;
    this.ui.deleteShape.disabled = isLocked || !hasSelectedElement;
    this.ui.playButton.disabled = this.isRunning;
    this.ui.stopButton.disabled = !this.isRunning;
    this.updateShapeTypeButtonStates(isLocked, hasSelectedElement);
    this.updateElementListButtons();
  }

  updateShapeTypeButtonStates(isLocked, hasSelectedElement) {
    const isDisabled = isLocked || hasSelectedElement;

    this.shapeTypeButtons.forEach((button) => {
      button.disabled = isDisabled;
    });
    this.clearShapeTypeButton.disabled = isDisabled || !this.ui.shapeType.value;
  }

  updateElementListButtons() {
    this.ui.elementList.querySelectorAll('button').forEach((button) => {
      button.disabled = this.isSceneLocked();
    });
  }

  isSceneLocked() {
    return this.isRunning || this.isWinSnapshotVisible;
  }

  getScore() {
    return getScore(
      this.playerShapes,
      this.playerJoints,
      this.playerForces,
      this.gravityModifier,
    );
  }

  getLevelShapes(key) {
    return this.level[key] ?? [];
  }

  getTolerance() {
    return this.level.tolerance ?? DEFAULTS.tolerance;
  }

  getRequiredHoldSeconds() {
    return this.level.requiredHoldSeconds ?? DEFAULTS.requiredHoldSeconds;
  }
}

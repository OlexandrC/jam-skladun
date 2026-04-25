import { ELEMENT_TYPES, UI_IDS } from '../constants.js';
import { getElementValue } from './elementCollection.js';
import { makeSelectOption, renderElementList } from './elementDom.js';
import {
  getDraftErrorText,
  getElementNote,
  getTimerText,
} from './uiText.js';

const NO_SHAPES_LABEL = 'No shapes';
const NO_OTHER_SHAPES_LABEL = 'No other shapes';
const SELECT_FIRST_SHAPE_LABEL = 'Select first shape';
const SELECT_SECOND_SHAPE_LABEL = 'Select second shape';
const SELECT_TARGET_SHAPE_LABEL = 'Select target shape';

export class GameSceneUiController {
  constructor(scene) {
    this.scene = scene;
    this.ui = this.getDomElements();
    this.setDomCollections();
  }

  getDomElements() {
    return Object.entries(UI_IDS).reduce((elements, [key, id]) => {
      const element = document.getElementById(id);

      if (!element) {
        throw new Error(`[GAMEUI-001] Missing UI element: ${id}`);
      }

      return { ...elements, [key]: element };
    }, {});
  }

  setDomCollections() {
    this.elementSettings = document.querySelectorAll('[data-element-settings]');
    this.elementTypeTabs = document.querySelectorAll('[data-element-type-tab]');
    this.shapeTypeButtons = document.querySelectorAll('[data-shape-type-button]');
    this.clearShapeTypeButton = document.querySelector('[data-shape-type-clear]');
    this.shapeParamSections = document.querySelectorAll('[data-shape-params]');
    this.rectangleParamSections = document.querySelectorAll('[data-rectangle-params]');
    this.jointParamSections = document.querySelectorAll('[data-joint-params]');
    this.forceParamSections = document.querySelectorAll('[data-force-params]');
    this.draftActionsSection = document.querySelector('[data-draft-actions]');
    this.panelViews = document.querySelectorAll('[data-panel-view]');
    this.panelTabs = document.querySelectorAll('[data-panel-tab]');
  }

  bindEvents() {
    this.ui.levelSelect.addEventListener('change', () => this.scene.selectLevel());
    this.ui.generateLevelButton.addEventListener('click', () => {
      this.scene.generateSelectedLevel();
    });
    this.ui.musicToggleButton.addEventListener('click', () => this.scene.toggleMusicPlayback());
    this.ui.elementType.addEventListener('change', () => this.scene.selectElementType());
    this.bindPanelTabEvents();
    this.bindElementTypeTabEvents();
    this.bindShapeTypeButtonEvents();
    this.bindElementListEvents();
    this.ui.shapeSelect.addEventListener('change', () => this.scene.selectPlayerElement());
    this.bindDraftInputEvents();
    this.ui.addShape.addEventListener('click', () => this.scene.addDraftElement());
    this.ui.updateShape.addEventListener('click', () => this.scene.updateSelectedElement());
    this.ui.cancelShape.addEventListener('click', () => this.scene.cancelSelectedElementEdit());
    this.ui.deleteShape.addEventListener('click', () => this.scene.deleteSelectedElement());
    this.ui.playButton.addEventListener('click', () => this.scene.startRun());
    this.ui.stopButton.addEventListener('click', () => this.scene.stopRun('Scene stopped'));
    this.ui.resetButton.addEventListener('click', () => this.scene.resetLevel());
  }

  bindPanelTabEvents() {
    this.panelTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.scene.selectPanelViewFromTab(tab.dataset.panelTab);
      });
    });
  }

  bindElementTypeTabEvents() {
    this.elementTypeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.scene.selectElementTypeFromTab(tab.dataset.elementTypeTab);
      });
    });
  }

  bindShapeTypeButtonEvents() {
    this.shapeTypeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.scene.selectDraftShapeType(button.dataset.shapeTypeButton);
      });
    });
    this.clearShapeTypeButton.addEventListener('click', () => this.scene.clearDraftShapeType());
  }

  bindElementListEvents() {
    this.ui.elementList.addEventListener('click', (event) => {
      const button = event.target.closest('button');

      if (button) {
        this.handleElementListButtonClick(button);
        return;
      }

      this.handleElementRowClick(event.target.closest('[data-element-row]'));
    });
  }

  handleElementListButtonClick(button) {
    if (this.scene.isSceneLocked()) {
      return;
    }

    if (button.dataset.elementEdit) {
      this.scene.selectElementForEditing(button.dataset.elementEdit);
      return;
    }

    if (button.dataset.elementDelete) {
      this.scene.deleteElementFromList(button.dataset.elementDelete);
    }
  }

  handleElementRowClick(row) {
    if (!row || this.scene.isSceneLocked()) {
      return;
    }

    this.scene.toggleHighlightedElement(row.dataset.elementRow);
  }

  bindDraftInputEvents() {
    this.getDraftInputs().forEach((input) => {
      input.addEventListener('input', () => this.scene.updateDraftFromForm());
      input.addEventListener('change', () => this.scene.updateDraftFromForm());
    });
  }

  getDraftInputs() {
    return [
      this.ui.shapeType,
      this.ui.shapeX,
      this.ui.shapeY,
      this.ui.shapeSize,
      this.ui.shapeWidth,
      this.ui.shapeMass,
      this.ui.shapeAngle,
      this.ui.shapeFixedX,
      this.ui.shapeFixedY,
      this.ui.shapeFixedAngle,
      this.ui.jointFirstShape,
      this.ui.jointSecondShape,
      this.ui.jointStrength,
      this.ui.jointDistance,
      this.ui.jointStart,
      this.ui.jointEnd,
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

  refreshElementSelect(elements, selectedElementValue) {
    const options = [makeSelectOption('', 'New element')];
    const elementOptions = elements.map((element) => {
      return makeSelectOption(getElementValue(element), element.name);
    });

    this.ui.shapeSelect.replaceChildren(...options, ...elementOptions);
    this.ui.shapeSelect.value = selectedElementValue;
    this.renderElementList(elements);
  }

  renderElementList(elements) {
    renderElementList(this.ui.elementList, elements, getElementValue);
    this.highlightSelectedElement(this.scene.highlightedElementValue);
  }

  highlightSelectedElement(selectedElementValue) {
    this.ui.elementList.querySelectorAll('[data-element-row]').forEach((row) => {
      row.classList.toggle('is-selected', row.dataset.elementRow === selectedElementValue);
    });
  }

  updateVisibleSettings() {
    this.elementSettings.forEach((section) => {
      section.hidden = section.dataset.elementSettings !== this.ui.elementType.value;
    });
    this.updateShapeParamsVisibility();
    this.updateRectangleParamsVisibility();
    this.updateJointParamsVisibility();
    this.updateForceParamsVisibility();
    this.updateDraftActionsVisibility();
    this.updatePanelViews();
    this.updateElementTypeTabs();
    this.updateShapeTypeButtons();
  }

  updateShapeParamsVisibility() {
    const isShape = this.ui.elementType.value === ELEMENT_TYPES.shape;
    const hasDraft = Boolean(this.ui.shapeType.value) || Boolean(this.scene.selectedElementValue);
    const areShapeParamsVisible = isShape && hasDraft;

    this.shapeParamSections.forEach((section) => {
      section.hidden = !areShapeParamsVisible;
    });
  }

  updateRectangleParamsVisibility() {
    const isRectangle = this.isShapeElementType() && this.ui.shapeType.value === 'rectangle';

    this.rectangleParamSections.forEach((section) => {
      section.hidden = !isRectangle;
    });
  }

  updateJointParamsVisibility() {
    const areJointParamsVisible = this.isJointElementType() && this.hasCompleteJointShapes();

    this.jointParamSections.forEach((section) => {
      section.hidden = !areJointParamsVisible;
    });
  }

  updateForceParamsVisibility() {
    const areForceParamsVisible = this.isForceElementType() && this.hasForceShape();

    this.forceParamSections.forEach((section) => {
      section.hidden = !areForceParamsVisible;
    });
  }

  updateDraftActionsVisibility() {
    this.draftActionsSection.hidden = !this.areDraftActionsVisible();
    this.updateDraftActionButtonsVisibility();
  }

  updateDraftActionButtonsVisibility() {
    const isEditing = Boolean(this.scene.selectedElementValue);

    this.ui.addShape.hidden = isEditing;
    this.ui.updateShape.hidden = !isEditing;
    this.ui.cancelShape.hidden = !isEditing;
    this.ui.deleteShape.hidden = !isEditing;
  }

  areDraftActionsVisible() {
    if (this.isShapeElementType()) {
      return Boolean(this.ui.shapeType.value) || Boolean(this.scene.selectedElementValue);
    }

    if (this.isJointElementType()) {
      return this.hasCompleteJointShapes();
    }

    if (this.isForceElementType()) {
      return this.hasForceShape();
    }

    return true;
  }

  isShapeElementType() {
    return this.ui.elementType.value === ELEMENT_TYPES.shape;
  }

  isJointElementType() {
    return this.ui.elementType.value === ELEMENT_TYPES.joint;
  }

  isForceElementType() {
    return this.ui.elementType.value === ELEMENT_TYPES.force;
  }

  hasCompleteJointShapes() {
    return Boolean(this.ui.jointFirstShape.value && this.ui.jointSecondShape.value);
  }

  hasForceShape() {
    return Boolean(this.ui.forceShape.value);
  }

  updatePanelViews() {
    this.panelViews.forEach((view) => {
      view.hidden = view.dataset.panelView !== this.scene.selectedPanelView;
    });
    this.updatePanelTabs();
  }

  updatePanelTabs() {
    this.panelTabs.forEach((tab) => {
      const isActive = tab.dataset.panelTab === this.scene.selectedPanelView;
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

  refreshShapeReferenceSelects(shapeNames) {
    this.refreshReferenceSelect(
      this.ui.jointFirstShape,
      shapeNames,
      SELECT_FIRST_SHAPE_LABEL,
    );
    this.refreshReferenceSelect(
      this.ui.jointSecondShape,
      this.getSecondJointShapeNames(shapeNames),
      SELECT_SECOND_SHAPE_LABEL,
      NO_OTHER_SHAPES_LABEL,
    );
    this.refreshReferenceSelect(this.ui.forceShape, shapeNames, SELECT_TARGET_SHAPE_LABEL);
  }

  getSecondJointShapeNames(shapeNames) {
    return shapeNames.filter((shapeName) => shapeName !== this.ui.jointFirstShape.value);
  }

  refreshReferenceSelect(select, values, placeholderLabel, emptyLabel = NO_SHAPES_LABEL) {
    const selectedValue = select.value;
    const options = [
      makeSelectOption('', values.length ? placeholderLabel : emptyLabel),
      ...values.map((value) => makeSelectOption(value, value)),
    ];

    select.replaceChildren(...options);
    select.value = values.includes(selectedValue) ? selectedValue : '';
  }

  updatePanel() {
    this.ui.elementNote.textContent = getElementNote(this.ui.elementType.value);
    this.ui.sceneGravityText.textContent = this.getSceneGravityText();
    this.ui.headerGravityText.textContent = this.getHeaderGravityText();
    this.ui.statusText.textContent = this.getStatusText();
    this.ui.scoreText.textContent = `Score: ${this.scene.getScore()}`;
    this.ui.timerText.textContent = getTimerText(
      this.scene.elapsedSeconds,
      this.scene.heldSeconds,
      this.scene.getRequiredHoldSeconds(),
    );
    this.updateButtonStates();
  }

  getSceneGravityText() {
    const gravity = this.scene.getVisibleGravity();

    return `Scene gravity now: X ${gravity.x}, Y ${gravity.y}`;
  }

  getHeaderGravityText() {
    const gravity = this.scene.getVisibleGravity();

    return `Gravity: X ${gravity.x}, Y ${gravity.y}`;
  }

  getStatusText() {
    if (!this.scene.isDraftValid && !this.scene.isSceneLocked()) {
      return `${this.scene.status}. ${getDraftErrorText(this.scene.draftElement)}`;
    }

    return this.scene.status;
  }

  updateButtonStates() {
    const hasSelectedElement = Boolean(this.scene.selectedElementValue);
    const isLocked = this.scene.isSceneLocked();

    this.ui.levelSelect.disabled = this.scene.isRunning;
    this.ui.generateLevelButton.disabled = this.scene.isRunning;
    this.ui.musicToggleButton.disabled = !this.scene.hasSelectedMusicTrack();
    this.ui.shapeSelect.disabled = isLocked;
    this.ui.elementType.disabled = isLocked || hasSelectedElement;
    this.elementTypeTabs.forEach((tab) => {
      tab.disabled = isLocked || hasSelectedElement;
    });
    this.getDraftInputs().forEach((input) => {
      input.disabled = isLocked;
    });
    this.ui.shapeType.disabled = isLocked || hasSelectedElement;
    this.ui.addShape.disabled = isLocked || !this.scene.isDraftValid || hasSelectedElement;
    this.ui.updateShape.disabled = isLocked || !hasSelectedElement || !this.scene.isDraftValid;
    this.ui.cancelShape.disabled = isLocked || !hasSelectedElement;
    this.ui.deleteShape.disabled = isLocked || !hasSelectedElement;
    this.ui.playButton.disabled = this.scene.isRunning || this.scene.hasPendingLevel();
    this.ui.stopButton.disabled = !this.scene.canStopRun();
    this.updateMusicToggleButton();
    this.updateShapeTypeButtonStates(isLocked, hasSelectedElement);
    this.updateElementListButtons();
  }

  updateMusicToggleButton() {
    const hasTrack = this.scene.hasSelectedMusicTrack();
    const isMuted = !hasTrack || this.scene.isMusicMuted;
    const buttonText = hasTrack && this.scene.isMusicMuted ? 'Unmute music' : 'Mute music';

    this.ui.musicToggleButton.innerHTML = getMusicToggleIconMarkup(isMuted);
    this.ui.musicToggleButton.classList.toggle('is-muted', isMuted);
    this.ui.musicToggleButton.setAttribute('aria-pressed', String(hasTrack && !this.scene.isMusicMuted));
    this.ui.musicToggleButton.setAttribute('aria-label', buttonText);
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
      button.disabled = this.scene.isSceneLocked();
    });
  }
}

function getMusicToggleIconMarkup(isMuted) {
  if (isMuted) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10 v4 h4 l5 4 V6 l-5 4 Z"></path><path d="M16 9 l5 6"></path><path d="M21 9 l-5 6"></path></svg>';
  }

  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10 v4 h4 l5 4 V6 l-5 4 Z"></path><path d="M16 9 c1.6 1.2 2.4 2.8 2.4 5 s-0.8 3.8 -2.4 5"></path><path d="M18.8 6.5 c2.3 1.9 3.7 4.5 3.7 7.5 s-1.4 5.6 -3.7 7.5"></path></svg>';
}

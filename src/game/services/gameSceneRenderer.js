import Phaser from 'phaser';
import { COLORS, ELEMENT_TYPES, GAME_AREA } from '../constants.js';
import { getShapeFromBodyRecord, isTimeWindowActive } from './runPhysics.js';
import { drawShape } from './shapeDrawer.js';

const MAX_GRAVITY_MAGNITUDE = Math.hypot(20, 20);
const FIXED_INDICATOR_RADIUS = 9;
const FIXED_INDICATOR_GAP = 21;
const FIXED_INDICATOR_OFFSET = 14;
const FIXED_INDICATOR_EDGE_PADDING = 12;

export class GameSceneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.labels = [];
  }

  render() {
    this.graphics.clear();
    this.clearLabels();
    this.drawGravityIndicator();
    this.drawLevelGoals();
    this.drawLevelStatics();
    this.drawDynamicShapes();
    this.drawStoredElements();
    this.drawDraftElement();
  }

  drawLevelGoals() {
    this.scene.level.goals.forEach((shape) => {
      drawShape(this.graphics, shape, {
        fillColor: COLORS.goal,
        fillAlpha: 0.22,
        lineColor: COLORS.goal,
        showRadiusIndicator: false,
      });
    });
  }

  drawLevelStatics() {
    this.scene.getLevelShapes('walls').forEach((shape) => this.drawStaticShape(shape, COLORS.wall));
    this.scene.getLevelShapes('obstacles').forEach((shape) => this.drawStaticShape(shape, COLORS.obstacle));

    if (!this.isRunViewVisible()) {
      this.scene.level.baseShapes.forEach((shape) => this.drawPlayerShape(shape, COLORS.base, false));
      this.scene.playerShapes.forEach((shape) => {
        const isSelected = this.isElementSelected('shape', shape.name);
        this.drawPlayerShape(shape, COLORS.player, true, isSelected);
      });
    }
  }

  drawStaticShape(shape, color) {
    drawShape(this.graphics, shape, {
      fillColor: color,
      fillAlpha: 0.92,
      lineColor: color,
      radiusLineColor: COLORS.background,
      radiusLineAlpha: 0.9,
    });
  }

  drawDynamicShapes() {
    if (!this.isRunViewVisible()) {
      return;
    }

    this.scene.runBodies.filter((record) => record.active).forEach((record) => {
      const color = this.getRecordColor(record);
      this.drawPlayerShape(getShapeFromBodyRecord(record), color, false);
    });
  }

  getRecordColor(record) {
    if (record.kind === 'base') {
      return COLORS.base;
    }

    if (record.kind === 'player') {
      return COLORS.player;
    }

    return COLORS.obstacle;
  }

  drawStoredElements() {
    const shouldLabel = !this.isRunViewVisible();

    this.scene.playerJoints.forEach((joint) => {
      const isSelected = this.isElementSelected('joint', joint.name);
      this.drawJointElement(joint, false, shouldLabel, isSelected);
    });
    this.scene.playerForces.forEach((force) => {
      const isSelected = this.isElementSelected('force', force.name);
      this.drawForceElement(force, false, shouldLabel, isSelected);
    });
  }

  drawDraftElement() {
    if (!this.isDraftElementVisible()) {
      return;
    }

    if (this.scene.draftElement.kind === ELEMENT_TYPES.shape) {
      if (!this.scene.draftShape) {
        return;
      }

      this.drawDraftShape();
      return;
    }

    if (this.scene.draftElement.kind === ELEMENT_TYPES.joint) {
      this.drawJointElement(this.scene.draftElement, true, true);
      return;
    }

    if (this.scene.draftElement.kind === ELEMENT_TYPES.force) {
      this.drawForceElement(this.scene.draftElement, true, true);
    }
  }

  drawGravityIndicator() {
    if (this.isRunViewVisible()) {
      return;
    }

    const arrow = this.getGravityIndicatorArrow();

    if (!arrow) {
      return;
    }

    this.drawArrow(arrow.startPoint, arrow.endPoint, COLORS.gravityIndicator, {
      alpha: 0.46,
      lineWidth: 7 + arrow.magnitude / MAX_GRAVITY_MAGNITUDE * 7,
      wingLength: 18 + arrow.magnitude / MAX_GRAVITY_MAGNITUDE * 12,
    });
  }

  isDraftElementVisible() {
    return !this.isRunViewVisible()
      && !this.scene.selectedElementValue
      && Boolean(this.scene.draftElement);
  }

  drawDraftShape() {
    const color = this.getDraftColor(COLORS.player);

    drawShape(this.graphics, this.scene.draftShape, {
      fillColor: color,
      fillAlpha: 0.36,
      lineColor: color,
      radiusLineColor: COLORS.background,
      radiusLineAlpha: 0.92,
    });
    this.addShapeLabel(this.scene.draftShape, color);
    this.drawFixedIndicators(this.scene.draftShape, color);
  }

  drawJointElement(joint, isDraft, shouldLabel, isSelected = false) {
    const points = this.getJointPoints(joint);

    if (!points) {
      return;
    }

    const color = this.getTimedElementColor(joint, COLORS.joint, isDraft);
    const lineColor = isSelected ? COLORS.selected : color;
    this.graphics.lineStyle(isSelected ? 5 : 3, lineColor, 0.9);
    this.graphics.lineBetween(points.first.x, points.first.y, points.second.x, points.second.y);

    if (shouldLabel) {
      this.addShapeLabel({ ...this.getMidPoint(points.first, points.second), name: joint.name }, color);
    }
  }

  drawForceElement(force, isDraft, shouldLabel, isSelected = false) {
    const startPoint = this.getShapePointByName(force.shapeName);

    if (!startPoint) {
      return;
    }

    const endPoint = this.getForceEndPoint(force, startPoint);
    const color = this.getTimedElementColor(force, COLORS.force, isDraft);
    const drawColor = isSelected ? COLORS.selected : color;
    this.drawArrow(startPoint, endPoint, drawColor);

    if (shouldLabel) {
      this.addShapeLabel({ ...endPoint, name: force.name }, color);
    }
  }

  getDraftColor(validColor) {
    if (!this.scene.isDraftValid) {
      return COLORS.invalid;
    }

    return validColor;
  }

  getTimedElementColor(element, activeColor, isDraft) {
    if (isDraft) {
      return this.getDraftColor(activeColor);
    }

    if (!this.isRunViewVisible()) {
      return activeColor;
    }

    return isTimeWindowActive(element, this.scene.elapsedSeconds) ? activeColor : COLORS.inactive;
  }

  getJointPoints(joint) {
    const first = this.getShapePointByName(joint.firstShapeName);
    const second = this.getShapePointByName(joint.secondShapeName);

    if (!first || !second) {
      return null;
    }

    return { first, second };
  }

  getShapePointByName(name) {
    if (this.isRunViewVisible()) {
      return this.getRunShapePointByName(name);
    }

    const shape = this.scene.playerShapes.find((playerShape) => playerShape.name === name);
    return shape ? { x: shape.x, y: shape.y } : null;
  }

  getRunShapePointByName(name) {
    const record = this.scene.getRunBodyRecordByName(name);

    if (!record?.active) {
      return null;
    }

    return {
      x: record.body.position.x,
      y: record.body.position.y,
    };
  }

  getForceEndPoint(force, startPoint) {
    const length = Math.hypot(force.directionX, force.directionY);

    if (length === 0) {
      return { ...startPoint };
    }

    const arrowLength = 45 + Math.min(force.strength, 100);

    return {
      x: startPoint.x + force.directionX / length * arrowLength,
      y: startPoint.y + force.directionY / length * arrowLength,
    };
  }

  getGravityIndicatorArrow() {
    const gravity = this.scene.getVisibleGravity();
    const magnitude = Math.hypot(gravity.x, gravity.y);

    if (magnitude === 0) {
      return null;
    }

    const arrowLength = 140 + magnitude / MAX_GRAVITY_MAGNITUDE * 180;
    const centerPoint = { x: GAME_AREA.width / 2, y: GAME_AREA.height / 2 };

    return {
      magnitude,
      startPoint: centerPoint,
      endPoint: {
        x: centerPoint.x + gravity.x / magnitude * arrowLength,
        y: centerPoint.y + gravity.y / magnitude * arrowLength,
      },
    };
  }

  drawArrow(startPoint, endPoint, color, options = {}) {
    const alpha = options.alpha ?? 0.9;
    const lineWidth = options.lineWidth ?? 3;
    const wingLength = options.wingLength ?? 12;
    const angle = Phaser.Math.Angle.Between(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    const firstWing = this.getArrowWingPoint(endPoint, angle + Math.PI * 0.82, wingLength);
    const secondWing = this.getArrowWingPoint(endPoint, angle - Math.PI * 0.82, wingLength);

    this.graphics.lineStyle(lineWidth, color, alpha);
    this.graphics.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    this.graphics.fillStyle(color, alpha);
    this.graphics.fillTriangle(endPoint.x, endPoint.y, firstWing.x, firstWing.y, secondWing.x, secondWing.y);
  }

  getArrowWingPoint(endPoint, angle, wingLength = 12) {
    return {
      x: endPoint.x + Math.cos(angle) * wingLength,
      y: endPoint.y + Math.sin(angle) * wingLength,
    };
  }

  getMidPoint(firstPoint, secondPoint) {
    return {
      x: (firstPoint.x + secondPoint.x) / 2,
      y: (firstPoint.y + secondPoint.y) / 2,
    };
  }

  drawPlayerShape(shape, color, shouldLabel, isSelected = false) {
    const lineColor = isSelected ? COLORS.selected : color;

    drawShape(this.graphics, shape, {
      fillColor: color,
      fillAlpha: 0.88,
      lineColor,
      lineWidth: isSelected ? 4 : 2,
      radiusLineColor: COLORS.background,
      radiusLineAlpha: 0.95,
    });

    if (shouldLabel) {
      this.addShapeLabel(shape, color);
    }

    this.drawFixedIndicators(shape, lineColor);
  }

  addShapeLabel(shape, color) {
    const label = this.scene.add.text(shape.x, shape.y, shape.name ?? shape.id, {
      color: COLORS.text,
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      stroke: Phaser.Display.Color.IntegerToColor(color).rgba,
      strokeThickness: 2,
    });

    label.setOrigin(0.5);
    this.labels.push(label);
  }

  clearLabels() {
    this.labels.forEach((label) => label.destroy());
    this.labels = [];
  }

  drawFixedIndicators(shape, color) {
    if (!this.shouldDrawFixedIndicators(shape)) {
      return;
    }

    const markers = this.getFixedMarkers(shape);
    const startPoint = this.getFixedIndicatorStartPoint(shape, markers.length);

    markers.forEach((marker, index) => {
      const center = { x: startPoint.x, y: startPoint.y + index * FIXED_INDICATOR_GAP };
      this.drawFixedIndicatorBadge(center, color);
      this.drawFixedIndicatorIcon(center, marker);
    });
  }

  shouldDrawFixedIndicators(shape) {
    return !this.isRunViewVisible()
      && Boolean(shape.fixedX || shape.fixedY || shape.fixedAngle);
  }

  getFixedMarkers(shape) {
    const markers = [];

    if (shape.fixedX) {
      markers.push('x');
    }

    if (shape.fixedY) {
      markers.push('y');
    }

    if (shape.fixedAngle) {
      markers.push('angle');
    }

    return markers;
  }

  getFixedIndicatorStartPoint(shape, markerCount) {
    const extents = this.getShapeIndicatorExtents(shape);
    const maxStartY = GAME_AREA.height
      - FIXED_INDICATOR_EDGE_PADDING
      - (markerCount - 1) * FIXED_INDICATOR_GAP;

    return {
      x: Phaser.Math.Clamp(
        shape.x + extents.x + FIXED_INDICATOR_OFFSET,
        FIXED_INDICATOR_EDGE_PADDING,
        GAME_AREA.width - FIXED_INDICATOR_EDGE_PADDING,
      ),
      y: Phaser.Math.Clamp(
        shape.y - extents.y + FIXED_INDICATOR_OFFSET,
        FIXED_INDICATOR_EDGE_PADDING,
        maxStartY,
      ),
    };
  }

  getShapeIndicatorExtents(shape) {
    if (shape.shape === 'circle') {
      return { x: shape.radius, y: shape.radius };
    }

    if (shape.shape === 'rectangle') {
      return this.getRectangleExtents(shape);
    }

    return { x: shape.radius, y: shape.radius };
  }

  getRectangleExtents(shape) {
    const halfWidth = shape.width / 2;
    const halfHeight = shape.height / 2;
    const angle = shape.angle ?? 0;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));

    return {
      x: cos * halfWidth + sin * halfHeight,
      y: sin * halfWidth + cos * halfHeight,
    };
  }

  drawFixedIndicatorBadge(center, color) {
    this.graphics.fillStyle(COLORS.background, 0.96);
    this.graphics.fillCircle(center.x, center.y, FIXED_INDICATOR_RADIUS);
    this.graphics.lineStyle(2, color, 0.95);
    this.graphics.strokeCircle(center.x, center.y, FIXED_INDICATOR_RADIUS);
  }

  drawFixedIndicatorIcon(center, marker) {
    this.graphics.lineStyle(2, COLORS.fixedIndicatorIcon, 1);

    if (marker === 'x') {
      this.drawHorizontalAxisIcon(center);
      return;
    }

    if (marker === 'y') {
      this.drawVerticalAxisIcon(center);
      return;
    }

    this.drawRotationIcon(center);
  }

  drawHorizontalAxisIcon(center) {
    this.graphics.lineBetween(center.x - 4, center.y, center.x + 4, center.y);
    this.graphics.lineBetween(center.x - 4, center.y, center.x - 2, center.y - 2);
    this.graphics.lineBetween(center.x - 4, center.y, center.x - 2, center.y + 2);
    this.graphics.lineBetween(center.x + 4, center.y, center.x + 2, center.y - 2);
    this.graphics.lineBetween(center.x + 4, center.y, center.x + 2, center.y + 2);
  }

  drawVerticalAxisIcon(center) {
    this.graphics.lineBetween(center.x, center.y - 4, center.x, center.y + 4);
    this.graphics.lineBetween(center.x, center.y - 4, center.x - 2, center.y - 2);
    this.graphics.lineBetween(center.x, center.y - 4, center.x + 2, center.y - 2);
    this.graphics.lineBetween(center.x, center.y + 4, center.x - 2, center.y + 2);
    this.graphics.lineBetween(center.x, center.y + 4, center.x + 2, center.y + 2);
  }

  drawRotationIcon(center) {
    const radius = 4.5;
    const startAngle = Phaser.Math.DegToRad(30);
    const endAngle = Phaser.Math.DegToRad(320);
    const arrowPoint = {
      x: center.x + Math.cos(endAngle) * radius,
      y: center.y + Math.sin(endAngle) * radius,
    };

    this.graphics.beginPath();
    this.graphics.arc(center.x, center.y, radius, startAngle, endAngle, false);
    this.graphics.strokePath();
    this.graphics.lineBetween(arrowPoint.x, arrowPoint.y, arrowPoint.x - 3.2, arrowPoint.y - 0.6);
    this.graphics.lineBetween(arrowPoint.x, arrowPoint.y, arrowPoint.x - 1.2, arrowPoint.y + 2.9);
  }

  isElementSelected(kind, name) {
    return this.scene.highlightedElementValue === `${kind}:${name}`;
  }

  isRunViewVisible() {
    return this.scene.isRunning || this.scene.isWinSnapshotVisible;
  }
}

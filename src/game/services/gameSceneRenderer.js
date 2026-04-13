import Phaser from 'phaser';
import { COLORS, ELEMENT_TYPES } from '../constants.js';
import { getShapeFromBodyRecord } from './runPhysics.js';
import { drawShape } from './shapeDrawer.js';

export class GameSceneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.labels = [];
  }

  render() {
    this.graphics.clear();
    this.clearLabels();
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
      });
    });
  }

  drawLevelStatics() {
    this.scene.getLevelShapes('walls').forEach((shape) => this.drawStaticShape(shape, COLORS.wall));
    this.scene.getLevelShapes('obstacles').forEach((shape) => this.drawStaticShape(shape, COLORS.obstacle));

    if (!this.isRunViewVisible()) {
      this.scene.level.baseShapes.forEach((shape) => this.drawPlayerShape(shape, COLORS.base, false));
      this.scene.playerShapes.forEach((shape) => this.drawPlayerShape(shape, COLORS.player, true));
    }
  }

  drawStaticShape(shape, color) {
    drawShape(this.graphics, shape, {
      fillColor: color,
      fillAlpha: 0.92,
      lineColor: color,
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

    this.scene.playerJoints.forEach((joint) => this.drawJointElement(joint, false, shouldLabel));
    this.scene.playerForces.forEach((force) => this.drawForceElement(force, false, shouldLabel));
  }

  drawDraftElement() {
    if (this.isRunViewVisible() || !this.scene.draftElement) {
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

  drawDraftShape() {
    const color = this.getDraftColor(COLORS.player);

    drawShape(this.graphics, this.scene.draftShape, {
      fillColor: color,
      fillAlpha: 0.36,
      lineColor: color,
    });
    this.addShapeLabel(this.scene.draftShape, color);
  }

  drawJointElement(joint, isDraft, shouldLabel) {
    const points = this.getJointPoints(joint);

    if (!points) {
      return;
    }

    const color = isDraft ? this.getDraftColor(COLORS.joint) : COLORS.joint;
    this.graphics.lineStyle(3, color, 0.9);
    this.graphics.lineBetween(points.first.x, points.first.y, points.second.x, points.second.y);

    if (shouldLabel) {
      this.addShapeLabel({ ...this.getMidPoint(points.first, points.second), name: joint.name }, color);
    }
  }

  drawForceElement(force, isDraft, shouldLabel) {
    const startPoint = this.getShapePointByName(force.shapeName);

    if (!startPoint) {
      return;
    }

    const endPoint = this.getForceEndPoint(force, startPoint);
    const color = isDraft ? this.getDraftColor(COLORS.force) : COLORS.force;
    this.drawArrow(startPoint, endPoint, color);

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

  drawArrow(startPoint, endPoint, color) {
    const angle = Phaser.Math.Angle.Between(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    const firstWing = this.getArrowWingPoint(endPoint, angle + Math.PI * 0.82);
    const secondWing = this.getArrowWingPoint(endPoint, angle - Math.PI * 0.82);

    this.graphics.lineStyle(3, color, 0.9);
    this.graphics.lineBetween(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    this.graphics.fillStyle(color, 0.9);
    this.graphics.fillTriangle(endPoint.x, endPoint.y, firstWing.x, firstWing.y, secondWing.x, secondWing.y);
  }

  getArrowWingPoint(endPoint, angle) {
    return {
      x: endPoint.x + Math.cos(angle) * 12,
      y: endPoint.y + Math.sin(angle) * 12,
    };
  }

  getMidPoint(firstPoint, secondPoint) {
    return {
      x: (firstPoint.x + secondPoint.x) / 2,
      y: (firstPoint.y + secondPoint.y) / 2,
    };
  }

  drawPlayerShape(shape, color, shouldLabel) {
    drawShape(this.graphics, shape, {
      fillColor: color,
      fillAlpha: 0.88,
      lineColor: color,
    });

    if (shouldLabel) {
      this.addShapeLabel(shape, color);
    }
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

  isRunViewVisible() {
    return this.scene.isRunning || this.scene.isWinSnapshotVisible;
  }
}

import { getShapeVertices } from './shapeGeometry.js';

export function drawShape(graphics, shape, style) {
  setShapeStyle(graphics, style);

  if (shape.shape === 'circle') {
    drawCircle(graphics, shape, style);
    return;
  }

  drawPolygon(graphics, shape);
}

function setShapeStyle(graphics, style) {
  graphics.fillStyle(style.fillColor, style.fillAlpha ?? 1);
  graphics.lineStyle(
    style.lineWidth ?? 2,
    style.lineColor ?? style.fillColor,
    style.lineAlpha ?? 1,
  );
}

function drawCircle(graphics, shape, style) {
  graphics.fillCircle(shape.x, shape.y, shape.radius);
  graphics.strokeCircle(shape.x, shape.y, shape.radius);

  if (style.showRadiusIndicator === false) {
    return;
  }

  drawCircleRadiusIndicator(graphics, shape, style);
}

function drawPolygon(graphics, shape) {
  const points = getShapeVertices(shape);

  graphics.fillPoints(points, true);
  graphics.strokePoints(points, true, true);
}

function drawCircleRadiusIndicator(graphics, shape, style) {
  const endPoint = getCircleRadiusEndPoint(shape, style);

  graphics.lineStyle(
    style.radiusLineWidth ?? 2,
    style.radiusLineColor ?? style.lineColor ?? style.fillColor,
    style.radiusLineAlpha ?? 1,
  );
  graphics.lineBetween(shape.x, shape.y, endPoint.x, endPoint.y);
}

function getCircleRadiusEndPoint(shape, style) {
  const angle = shape.angle ?? 0;
  const radiusInset = Math.max((style.lineWidth ?? 2) * 0.5, 1);
  const radius = Math.max(shape.radius - radiusInset, 0);

  return {
    x: shape.x + Math.cos(angle) * radius,
    y: shape.y + Math.sin(angle) * radius,
  };
}

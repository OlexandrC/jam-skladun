import { getShapeVertices } from './shapeGeometry.js';

export function drawShape(graphics, shape, style) {
  setShapeStyle(graphics, style);

  if (shape.shape === 'circle') {
    drawCircle(graphics, shape);
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

function drawCircle(graphics, shape) {
  graphics.fillCircle(shape.x, shape.y, shape.radius);
  graphics.strokeCircle(shape.x, shape.y, shape.radius);
}

function drawPolygon(graphics, shape) {
  const points = getShapeVertices(shape);

  graphics.fillPoints(points, true);
  graphics.strokePoints(points, true, true);
}

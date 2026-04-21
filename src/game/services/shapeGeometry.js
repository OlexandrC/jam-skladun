const FULL_CIRCLE = Math.PI * 2;
const TRIANGLE_MATTER_OFFSET = Math.PI / 3;

export function getShapeVertices(shape) {
  if (shape.shape === 'rectangle') {
    return getRectangleVertices(shape);
  }

  if (shape.shape === 'triangle') {
    return getTriangleVertices(shape);
  }

  return [];
}

export function isPointInsideShape(point, shape) {
  if (shape.shape === 'circle') {
    return getPointDistance(point, shape) <= shape.radius;
  }

  return isPointInsidePolygon(point, getShapeVertices(shape));
}

export function isShapeInsideShape(innerShape, outerShape, tolerance) {
  if (outerShape.shape === 'circle') {
    return isShapeInsideCircle(innerShape, outerShape, tolerance);
  }

  if (innerShape.shape === 'circle') {
    return isCircleInsidePolygon(innerShape, getShapeVertices(outerShape), tolerance);
  }

  return getShapeVertices(innerShape).every((point) => {
    return isPointInsidePolygon(point, getShapeVertices(outerShape), tolerance);
  });
}

export function isShapeColliding(firstShape, secondShape) {
  if (firstShape.shape === 'circle' && secondShape.shape === 'circle') {
    return isCircleCollidingWithCircle(firstShape, secondShape);
  }

  if (firstShape.shape === 'circle') {
    return isCircleCollidingWithPolygon(firstShape, getShapeVertices(secondShape));
  }

  if (secondShape.shape === 'circle') {
    return isCircleCollidingWithPolygon(secondShape, getShapeVertices(firstShape));
  }

  return arePolygonsColliding(getShapeVertices(firstShape), getShapeVertices(secondShape));
}

function getRectangleVertices(shape) {
  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;
  const points = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return points.map((point) => rotatePoint(point, shape));
}

function getTriangleVertices(shape) {
  const baseAngle = (shape.angle ?? 0) + TRIANGLE_MATTER_OFFSET;

  return [0, 1, 2].map((index) => {
    const angle = baseAngle + FULL_CIRCLE * index / 3;

    return {
      x: shape.x + Math.cos(angle) * shape.radius,
      y: shape.y + Math.sin(angle) * shape.radius,
    };
  });
}

function rotatePoint(point, shape) {
  const angle = shape.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: shape.x + point.x * cos - point.y * sin,
    y: shape.y + point.x * sin + point.y * cos,
  };
}

function isShapeInsideCircle(shape, circle, tolerance) {
  if (shape.shape === 'circle') {
    return getDistance(shape, circle) + shape.radius <= circle.radius + tolerance;
  }

  return getShapeVertices(shape).every((point) => {
    return getPointDistance(point, circle) <= circle.radius + tolerance;
  });
}

function isCircleInsidePolygon(circle, polygon, tolerance) {
  if (!isPointInsidePolygon(circle, polygon, tolerance)) {
    return false;
  }

  return polygon.every((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length];
    return getPointSegmentDistance(circle, point, nextPoint) + tolerance >= circle.radius;
  });
}

function isPointInsidePolygon(point, polygon, tolerance = 0) {
  if (isPointNearPolygonEdge(point, polygon, tolerance)) {
    return true;
  }

  return getRayCrossingCount(point, polygon) % 2 === 1;
}

function isPointNearPolygonEdge(point, polygon, tolerance) {
  return polygon.some((startPoint, index) => {
    const endPoint = polygon[(index + 1) % polygon.length];
    return getPointSegmentDistance(point, startPoint, endPoint) <= tolerance;
  });
}

function getRayCrossingCount(point, polygon) {
  return polygon.reduce((count, startPoint, index) => {
    const endPoint = polygon[(index + 1) % polygon.length];

    if (!isRayCrossingSegment(point, startPoint, endPoint)) {
      return count;
    }

    return count + 1;
  }, 0);
}

function isRayCrossingSegment(point, startPoint, endPoint) {
  const isBetweenY = startPoint.y > point.y !== endPoint.y > point.y;

  if (!isBetweenY) {
    return false;
  }

  const segmentX = (endPoint.x - startPoint.x) * (point.y - startPoint.y);
  const crossingX = segmentX / (endPoint.y - startPoint.y) + startPoint.x;

  return point.x < crossingX;
}

function isCircleCollidingWithCircle(firstCircle, secondCircle) {
  return getDistance(firstCircle, secondCircle) < firstCircle.radius + secondCircle.radius;
}

function isCircleCollidingWithPolygon(circle, polygon) {
  if (isPointInsidePolygon(circle, polygon)) {
    return true;
  }

  if (polygon.some((point) => getPointDistance(point, circle) < circle.radius)) {
    return true;
  }

  return polygon.some((point, index) => {
    const nextPoint = polygon[(index + 1) % polygon.length];
    return getPointSegmentDistance(circle, point, nextPoint) < circle.radius;
  });
}

function arePolygonsColliding(firstPolygon, secondPolygon) {
  if (hasAnySegmentIntersection(firstPolygon, secondPolygon)) {
    return true;
  }

  return isPointInsidePolygon(firstPolygon[0], secondPolygon)
    || isPointInsidePolygon(secondPolygon[0], firstPolygon);
}

function hasAnySegmentIntersection(firstPolygon, secondPolygon) {
  return firstPolygon.some((firstStart, firstIndex) => {
    const firstEnd = firstPolygon[(firstIndex + 1) % firstPolygon.length];
    return hasSegmentIntersection(firstStart, firstEnd, secondPolygon);
  });
}

function hasSegmentIntersection(firstStart, firstEnd, polygon) {
  return polygon.some((secondStart, secondIndex) => {
    const secondEnd = polygon[(secondIndex + 1) % polygon.length];
    return areSegmentsIntersecting(firstStart, firstEnd, secondStart, secondEnd);
  });
}

function areSegmentsIntersecting(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = getDirection(firstStart, firstEnd, secondStart);
  const secondDirection = getDirection(firstStart, firstEnd, secondEnd);
  const thirdDirection = getDirection(secondStart, secondEnd, firstStart);
  const fourthDirection = getDirection(secondStart, secondEnd, firstEnd);

  return firstDirection * secondDirection < 0 && thirdDirection * fourthDirection < 0;
}

function getDirection(startPoint, endPoint, point) {
  const left = point.x - startPoint.x;
  const top = point.y - startPoint.y;
  const right = endPoint.x - startPoint.x;
  const bottom = endPoint.y - startPoint.y;

  return left * bottom - top * right;
}

function getPointSegmentDistance(point, startPoint, endPoint) {
  const lengthSquared = getSquaredDistance(startPoint, endPoint);

  if (lengthSquared === 0) {
    return getPointDistance(point, startPoint);
  }

  return getProjectedPointDistance(point, startPoint, endPoint, lengthSquared);
}

function getProjectedPointDistance(point, startPoint, endPoint, lengthSquared) {
  const progressX = point.x - startPoint.x;
  const progressY = point.y - startPoint.y;
  const segmentX = endPoint.x - startPoint.x;
  const segmentY = endPoint.y - startPoint.y;
  const progress = (progressX * segmentX + progressY * segmentY) / lengthSquared;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return getPointDistance(point, {
    x: startPoint.x + segmentX * clampedProgress,
    y: startPoint.y + segmentY * clampedProgress,
  });
}

function getDistance(firstPoint, secondPoint) {
  return getPointDistance(firstPoint, secondPoint);
}

function getPointDistance(firstPoint, secondPoint) {
  return Math.sqrt(getSquaredDistance(firstPoint, secondPoint));
}

function getSquaredDistance(firstPoint, secondPoint) {
  const distanceX = firstPoint.x - secondPoint.x;
  const distanceY = firstPoint.y - secondPoint.y;

  return distanceX * distanceX + distanceY * distanceY;
}

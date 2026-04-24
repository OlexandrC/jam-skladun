import Phaser from 'phaser';
import { makeMatterBody } from './runPhysics.js';

const MatterCollision = Phaser.Physics.Matter.Matter.Collision;
const MatterQuery = Phaser.Physics.Matter.Matter.Query;

export function getShapeVertices(shape) {
  return getBodyVertices(makeMatterBody(shape, true));
}

export function isPointInsideShape(point, shape) {
  return isPointInsideBody(point, makeMatterBody(shape, true), 0);
}

export function isShapeInsideShape(innerShape, outerShape, tolerance) {
  const innerBody = makeMatterBody(innerShape, true);
  const outerBody = makeMatterBody(outerShape, true);

  return getContainmentPoints(innerBody).every((point) => {
    return isPointInsideBody(point, outerBody, tolerance);
  });
}

export function isShapeColliding(firstShape, secondShape) {
  return isBodiesColliding(
    makeMatterBody(firstShape, true),
    makeMatterBody(secondShape, true),
  );
}

function isBodiesColliding(firstBody, secondBody) {
  return getBodyParts(firstBody).some((firstPart) => {
    return getBodyParts(secondBody).some((secondPart) => {
      return Boolean(MatterCollision.collides(firstPart, secondPart));
    });
  });
}

function getContainmentPoints(body) {
  return [copyPoint(body.position), ...getBodyVertices(body)];
}

function getBodyVertices(body) {
  return getBodyParts(body).reduce((points, part) => {
    part.vertices.forEach((vertex) => points.push(copyPoint(vertex)));
    return points;
  }, []);
}

function getBodyParts(body) {
  if (body.parts.length === 1) {
    return [body];
  }

  return body.parts.slice(1);
}

function isPointInsideBody(point, body, tolerance) {
  if (MatterQuery.point([body], point).length > 0) {
    return true;
  }

  if (tolerance <= 0) {
    return false;
  }

  return getBodyParts(body).some((part) => {
    return isPointNearVertices(point, part.vertices, tolerance);
  });
}

function isPointNearVertices(point, vertices, tolerance) {
  return vertices.some((startPoint, index) => {
    const endPoint = vertices[(index + 1) % vertices.length];
    return getPointSegmentDistance(point, startPoint, endPoint) <= tolerance;
  });
}

function getPointSegmentDistance(point, startPoint, endPoint) {
  const lengthSquared = getSquaredDistance(startPoint, endPoint);

  if (lengthSquared === 0) {
    return getPointDistance(point, startPoint);
  }

  const progress = getProjectedProgress(point, startPoint, endPoint, lengthSquared);

  return getPointDistance(point, {
    x: startPoint.x + (endPoint.x - startPoint.x) * progress,
    y: startPoint.y + (endPoint.y - startPoint.y) * progress,
  });
}

function getProjectedProgress(point, startPoint, endPoint, lengthSquared) {
  const progressX = point.x - startPoint.x;
  const progressY = point.y - startPoint.y;
  const segmentX = endPoint.x - startPoint.x;
  const segmentY = endPoint.y - startPoint.y;
  const progress = (progressX * segmentX + progressY * segmentY) / lengthSquared;

  return Math.max(0, Math.min(1, progress));
}

function getPointDistance(firstPoint, secondPoint) {
  return Math.sqrt(getSquaredDistance(firstPoint, secondPoint));
}

function getSquaredDistance(firstPoint, secondPoint) {
  const distanceX = firstPoint.x - secondPoint.x;
  const distanceY = firstPoint.y - secondPoint.y;

  return distanceX * distanceX + distanceY * distanceY;
}

function copyPoint(point) {
  return {
    x: point.x,
    y: point.y,
  };
}

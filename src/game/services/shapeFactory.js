export function makePlayerShape(values) {
  const baseShape = getBaseShape(values);

  if (values.shape === 'rectangle') {
    return {
      ...baseShape,
      width: getRectangleWidth(values),
      height: getRectangleHeight(values),
    };
  }

  return {
    ...baseShape,
    radius: values.size,
  };
}

export function getShapeSize(shape) {
  if (shape.shape === 'rectangle') {
    return shape.height;
  }

  return shape.radius;
}

const TRIANGLE_BASE_ANGLE = Math.PI / 2;

export function getBaseAngle(shape) {
  return shape === 'triangle' ? TRIANGLE_BASE_ANGLE : 0;
}

function getBaseShape(values) {
  return {
    name: values.name,
    shape: values.shape,
    x: values.x,
    y: values.y,
    mass: values.mass,
    angle: (values.angle ?? 0) + getBaseAngle(values.shape),
    fixedX: Boolean(values.fixedX),
    fixedY: Boolean(values.fixedY),
    fixedAngle: Boolean(values.fixedAngle),
  };
}

function getRectangleWidth(values) {
  return values.width ?? values.size;
}

function getRectangleHeight(values) {
  return values.height ?? values.size;
}

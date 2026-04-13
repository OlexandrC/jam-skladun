export function makePlayerShape(values) {
  const baseShape = getBaseShape(values);

  if (values.shape === 'rectangle') {
    return {
      ...baseShape,
      width: values.size,
      height: values.size,
    };
  }

  return {
    ...baseShape,
    radius: values.size,
  };
}

export function getShapeSize(shape) {
  if (shape.shape === 'rectangle') {
    return shape.width;
  }

  return shape.radius;
}

function getBaseShape(values) {
  return {
    name: values.name,
    shape: values.shape,
    x: values.x,
    y: values.y,
    mass: values.mass,
    angle: values.angle ?? 0,
  };
}

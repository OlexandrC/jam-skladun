import Phaser from 'phaser';

export function getNumberInput(input, fallback, min, max) {
  const parsedValue = Number(input.value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Phaser.Math.Clamp(parsedValue, min, max);
}

export function getOptionalNumberInput(input, min, max) {
  if (input.value === '') {
    return null;
  }

  return getNumberInput(input, null, min, max);
}

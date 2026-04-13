import { STORAGE_KEYS } from '../constants.js';

const EMPTY_STATS = {
  best: null,
  worst: null,
  total: 0,
  count: 0,
};

export function getScoreStats() {
  try {
    return getStoredStats();
  } catch (error) {
    console.warn('[SCORESTORE-001] Failed to read score stats.', error);
    return { ...EMPTY_STATS };
  }
}

export function updateScoreStats(score) {
  const stats = getScoreStats();
  const nextStats = {
    best: getBestScore(stats.best, score),
    worst: getWorstScore(stats.worst, score),
    total: stats.total + score,
    count: stats.count + 1,
  };

  localStorage.setItem(STORAGE_KEYS.scoreStats, JSON.stringify(nextStats));
  return nextStats;
}

export function getAverageScore(stats) {
  if (stats.count === 0) {
    return null;
  }

  return stats.total / stats.count;
}

function getStoredStats() {
  const rawStats = localStorage.getItem(STORAGE_KEYS.scoreStats);

  if (!rawStats) {
    return { ...EMPTY_STATS };
  }

  return sanitizeStats(JSON.parse(rawStats));
}

function sanitizeStats(stats) {
  return {
    best: getNullableNumber(stats.best),
    worst: getNullableNumber(stats.worst),
    total: Number(stats.total) || 0,
    count: Number(stats.count) || 0,
  };
}

function getNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

function getBestScore(currentBest, score) {
  if (currentBest === null) {
    return score;
  }

  return Math.min(currentBest, score);
}

function getWorstScore(currentWorst, score) {
  if (currentWorst === null) {
    return score;
  }

  return Math.max(currentWorst, score);
}

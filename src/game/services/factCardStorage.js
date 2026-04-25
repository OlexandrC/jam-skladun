import { STORAGE_KEYS } from '../constants.js';

const EMPTY_PROGRESS = {
  shownFactIds: [],
};

export function getNextFactCard(factEntries) {
  if (!factEntries.length) {
    return null;
  }

  const progress = getFactProgress(factEntries);
  const unseenFactEntries = getUnseenFactEntries(factEntries, progress.shownFactIds);
  const nextPool = unseenFactEntries.length ? unseenFactEntries : factEntries;

  return getRandomFactEntry(nextPool);
}

export function setFactCardShown(factEntries, factId) {
  if (!factEntries.length || !factId) {
    return;
  }

  const progress = getFactProgress(factEntries);
  const unseenFactEntries = getUnseenFactEntries(factEntries, progress.shownFactIds);
  const nextShownFactIds = getNextShownFactIds(progress.shownFactIds, unseenFactEntries, factId);

  setFactProgress({ shownFactIds: nextShownFactIds });
}

function getFactProgress(factEntries) {
  try {
    const rawProgress = localStorage.getItem(STORAGE_KEYS.factProgress);

    if (!rawProgress) {
      return { ...EMPTY_PROGRESS };
    }

    return sanitizeProgress(JSON.parse(rawProgress), factEntries);
  } catch (error) {
    console.warn('[FACTSTORE-001] Failed to read fact progress.', error);
    return { ...EMPTY_PROGRESS };
  }
}

function setFactProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEYS.factProgress, JSON.stringify(progress));
  } catch (error) {
    console.warn('[FACTSTORE-002] Failed to save fact progress.', error);
  }
}

function sanitizeProgress(progress, factEntries) {
  const availableFactIds = new Set(factEntries.map(({ id }) => id));
  const shownFactIds = Array.isArray(progress?.shownFactIds)
    ? progress.shownFactIds.filter((id) => availableFactIds.has(id))
    : [];

  return { shownFactIds };
}

function getUnseenFactEntries(factEntries, shownFactIds) {
  const shownFactIdSet = new Set(shownFactIds);

  return factEntries.filter(({ id }) => !shownFactIdSet.has(id));
}

function getRandomFactEntry(factEntries) {
  const index = Math.floor(Math.random() * factEntries.length);

  return factEntries[index];
}

function getNextShownFactIds(shownFactIds, unseenFactEntries, nextEntryId) {
  const currentFactIds = unseenFactEntries.length ? shownFactIds : [];

  return [...new Set([...currentFactIds, nextEntryId])];
}

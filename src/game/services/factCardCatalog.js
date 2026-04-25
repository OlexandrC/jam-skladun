export const FACT_CARD_DATA_KEY = 'mechanism-facts';
export const FACT_CARD_DATA_URL = new URL('../../assets/facts.json', import.meta.url).href;

const FACT_CARD_IMAGE_MODULES = import.meta.glob(
  '../../assets/images/*.{png,jpg,jpeg,webp,avif,gif,svg}',
  { eager: true, import: 'default' },
);

const FACT_CARD_IMAGE_ASSETS = Object.entries(FACT_CARD_IMAGE_MODULES)
  .map(([path, url]) => makeImageAsset(path, url))
  .filter(({ slug }) => Boolean(slug));

const FACT_CARD_IMAGE_KEYS = Object.fromEntries(
  FACT_CARD_IMAGE_ASSETS.map(({ slug, key }) => [slug, key]),
);

export function getFactCardImageAssets() {
  return FACT_CARD_IMAGE_ASSETS;
}

export function getFactCardEntries(factGroups) {
  if (!Array.isArray(factGroups)) {
    return [];
  }

  return factGroups.flatMap((group) => getGroupFactEntries(group));
}

function getGroupFactEntries(group) {
  const imageKey = getFactCardImageKey(group?.mechanism);
  const facts = Array.isArray(group?.facts) ? group.facts : [];

  if (!imageKey) {
    return [];
  }

  return facts
    .map((fact, index) => makeFactEntry(group.mechanism, fact, index, imageKey))
    .filter(Boolean);
}

function makeFactEntry(mechanism, fact, index, imageKey) {
  if (typeof fact !== 'string' || !fact.trim()) {
    return null;
  }

  return {
    id: `${normalizeName(mechanism)}:${index}`,
    imageKey,
    text: fact.trim(),
  };
}

function getFactCardImageKey(mechanism) {
  return FACT_CARD_IMAGE_KEYS[normalizeName(mechanism)] ?? '';
}

function makeImageAsset(path, url) {
  const slug = getFileSlug(path);

  return {
    key: `fact-image-${slug}`,
    slug,
    url,
  };
}

function getFileSlug(path) {
  const fileName = path.split('/').pop() ?? '';

  return normalizeName(fileName.replace(/\.[^.]+$/, ''));
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

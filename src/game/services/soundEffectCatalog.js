const COLLISION_SOUND_MODULES = import.meta.glob(
  '../../assets/soundeffects/*.{ogg,mp3,wav,m4a,aac}',
  { eager: true, import: 'default' },
);

const COLLISION_SOUND_ASSETS = Object.entries(COLLISION_SOUND_MODULES)
  .map(([path, url]) => makeCollisionSoundAsset(path, url))
  .filter(Boolean);

export function getCollisionSoundAssets() {
  return COLLISION_SOUND_ASSETS;
}

export function getRandomCollisionSoundKey(soundKeys, currentSoundKey = '') {
  if (soundKeys.length === 0) {
    return '';
  }

  const availableSoundKeys = soundKeys.filter((soundKey) => soundKey !== currentSoundKey);
  const soundPool = availableSoundKeys.length > 0 ? availableSoundKeys : soundKeys;
  const soundIndex = Math.floor(Math.random() * soundPool.length);

  return soundPool[soundIndex] ?? '';
}

function makeCollisionSoundAsset(path, url) {
  const slug = getFileSlug(path);

  if (!slug || typeof url !== 'string') {
    return null;
  }

  return {
    key: `collision-sound-${slug}`,
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

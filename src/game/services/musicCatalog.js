const MUSIC_TRACK_MODULES = import.meta.glob(
  '../../assets/music/*.{ogg,mp3,wav,m4a,aac}',
  { eager: true, import: 'default' },
);

const MUSIC_TRACKS = Object.entries(MUSIC_TRACK_MODULES)
  .map(([path, url]) => makeMusicTrack(path, url))
  .filter(Boolean);

export function getMusicTracks() {
  return MUSIC_TRACKS;
}

export function getRandomMusicTrack(tracks, currentTrackKey = '') {
  if (tracks.length === 0) {
    return null;
  }

  const availableTracks = tracks.filter((track) => track.key !== currentTrackKey);
  const trackPool = availableTracks.length > 0 ? availableTracks : tracks;
  const trackIndex = Math.floor(Math.random() * trackPool.length);

  return trackPool[trackIndex] ?? null;
}

function makeMusicTrack(path, url) {
  const slug = getFileSlug(path);

  if (!slug || typeof url !== 'string') {
    return null;
  }

  return {
    key: `music-${slug}`,
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

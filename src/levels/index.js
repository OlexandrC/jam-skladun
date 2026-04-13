const storyLevelModules = import.meta.glob('./story/*.js', {
  eager: true,
  import: 'default',
});

export function getStoryLevels() {
  return Object.entries(storyLevelModules)
    .sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath))
    .map(([, level]) => level);
}

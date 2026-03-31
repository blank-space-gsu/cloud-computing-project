export function selectPreferredTeam(teams = []) {
  if (!teams.length) return null;

  return teams.find((team) =>
    String(team.name || '').toLowerCase().includes('demo') ||
    String(team.description || '').toLowerCase().includes('demo')
  ) || teams[0];
}

export function sortTeamsForDemo(teams = []) {
  const preferred = selectPreferredTeam(teams);
  if (!preferred) return teams;

  return [...teams].sort((a, b) => {
    if (a.id === preferred.id) return -1;
    if (b.id === preferred.id) return 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

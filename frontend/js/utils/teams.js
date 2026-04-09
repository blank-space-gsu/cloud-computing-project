const PRIMARY_DEMO_TEAM_NAME = 'physical demo group';

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function isDemoTeam(team) {
  return normalized(team.name).includes('demo') || normalized(team.description).includes('demo');
}

function hasVisibleRoster(team) {
  return Number(team.memberCount || 0) > 0 || Number(team.managerCount || 0) > 0;
}

export function getVisibleTeams(teams = []) {
  if (!teams.length) return [];

  const physicalDemoGroup = teams.find((team) => normalized(team.name) === PRIMARY_DEMO_TEAM_NAME);
  if (physicalDemoGroup) {
    return [physicalDemoGroup];
  }

  const demoTeams = teams.filter(isDemoTeam);
  if (demoTeams.length) {
    const populatedDemoTeams = demoTeams.filter(hasVisibleRoster);
    return [populatedDemoTeams[0] || demoTeams[0]];
  }

  return teams;
}

export function selectPreferredTeam(teams = []) {
  return getVisibleTeams(teams)[0] || null;
}

export function sortTeamsForDemo(teams = []) {
  return getVisibleTeams(teams);
}

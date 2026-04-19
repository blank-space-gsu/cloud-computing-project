const STORAGE_KEY = 'taskflow-local-team-state-v1';

function defaultState() {
  return {
    customTeams: [],
    overrides: {},
    additions: {},
    events: []
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stripBackendTeamArtifacts(state, backendTeamIds = []) {
  const ids = new Set((backendTeamIds || []).filter(Boolean));
  if (!ids.size) return state;

  let changed = false;
  const overrides = { ...(state.overrides || {}) };
  const additions = { ...(state.additions || {}) };

  ids.forEach((teamId) => {
    if (Object.hasOwn(overrides, teamId)) {
      delete overrides[teamId];
      changed = true;
    }

    if (Object.hasOwn(additions, teamId)) {
      delete additions[teamId];
      changed = true;
    }
  });

  if (!changed) {
    return state;
  }

  const nextState = {
    ...state,
    overrides,
    additions
  };

  writeState(nextState);
  return nextState;
}

function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function snapshotUser(person, membershipRole = person.membershipRole || (person.appRole === 'manager' ? 'manager' : 'member')) {
  return {
    id: person.id,
    fullName: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    email: person.email || '',
    jobTitle: person.jobTitle || '',
    appRole: person.appRole || 'employee',
    membershipRole
  };
}

function applyOverride(team, override) {
  if (!override) return { ...team };
  return {
    ...team,
    name: override.name || team.name,
    description: override.description || team.description
  };
}

function buildCustomTeamCard(team, currentUser) {
  return {
    id: team.id,
    name: team.name,
    description: team.description || 'Custom team created in the frontend demo workspace.',
    memberCount: team.members.length + team.managers.length,
    managerCount: team.managers.length,
    canManageTeam: team.managers.some((member) => member.id === currentUser.id),
    isLocalTeam: true
  };
}

function isUserVisibleInCustomTeam(team, userId) {
  return team.managers.some((member) => member.id === userId) || team.members.some((member) => member.id === userId);
}

export function getWorkspaceTeams(baseTeams = [], currentUser) {
  const state = stripBackendTeamArtifacts(readState(), baseTeams.map((team) => team.id));
  const teams = baseTeams.map((team) => ({
    ...team,
    isLocalTeam: false
  }));

  const customTeams = state.customTeams
    .filter((team) => currentUser && isUserVisibleInCustomTeam(team, currentUser.id))
    .map((team) => buildCustomTeamCard(team, currentUser));

  return [...teams, ...customTeams];
}

export function getTeamDetail(teamId, { baseTeam = null, baseMembers = [], currentUser = null } = {}) {
  const state = stripBackendTeamArtifacts(
    readState(),
    baseTeam?.id ? [baseTeam.id] : [teamId]
  );
  const customTeam = state.customTeams.find((team) => team.id === teamId);

  if (customTeam) {
    const members = [
      ...customTeam.managers.map((member) => ({ ...member, membershipRole: 'manager' })),
      ...customTeam.members.map((member) => ({ ...member, membershipRole: 'member' }))
    ];

    return {
      team: buildCustomTeamCard(customTeam, currentUser || members[0] || { id: '' }),
      members
    };
  }

  const team = applyOverride(baseTeam || { id: teamId }, null);
  const members = uniqueById(baseMembers);

  const managerCount = members.filter((member) => member.membershipRole === 'manager').length;

  return {
    team: {
      ...team,
      memberCount: members.length,
      managerCount,
      isLocalTeam: false
    },
    members
  };
}

export function createCustomTeam({ name, description, currentUser, selectedMembers = [] }) {
  const state = readState();
  const manager = snapshotUser(currentUser, 'manager');
  const members = uniqueById(selectedMembers.map((member) => snapshotUser(member, 'member')));

  const team = {
    id: createId('local-team'),
    name,
    description,
    managers: [manager],
    members,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.customTeams.push(team);

  members.forEach((member) => {
    state.events.push({
      id: createId('team-event'),
      type: 'team_added',
      userId: member.id,
      teamId: team.id,
      teamName: team.name,
      message: `You were added to ${team.name}.`,
      createdAt: new Date().toISOString()
    });
  });

  writeState(state);
  return team;
}

export function updateTeamRecord(teamId, { name, description }) {
  const state = readState();
  const customTeam = state.customTeams.find((team) => team.id === teamId);

  if (customTeam) {
    customTeam.name = name || customTeam.name;
    customTeam.description = description || customTeam.description;
    customTeam.updatedAt = new Date().toISOString();
    writeState(state);
    return;
  }

  state.overrides[teamId] = {
    ...(state.overrides[teamId] || {}),
    name,
    description
  };
  writeState(state);
}

export function assignPeopleToTeam(teamId, people = [], options = {}) {
  const state = readState();
  const customTeam = state.customTeams.find((team) => team.id === teamId);
  const snapshots = uniqueById(people.map((person) => snapshotUser(person, 'member')));

  if (customTeam) {
    const existing = new Set(customTeam.members.map((member) => member.id));
    snapshots.forEach((member) => {
      if (!existing.has(member.id)) {
        customTeam.members.push(member);
        state.events.push({
          id: createId('team-event'),
          type: 'team_added',
          userId: member.id,
          teamId,
          teamName: customTeam.name,
          message: `You were added to ${customTeam.name}.`,
          createdAt: new Date().toISOString()
        });
      }
    });
    customTeam.updatedAt = new Date().toISOString();
    writeState(state);
    return;
  }

  const additions = state.additions[teamId] || [];
  const existing = new Set(additions.map((member) => member.id));
  const nextAdditions = [...additions];

  snapshots.forEach((member) => {
    if (!existing.has(member.id)) {
      nextAdditions.push(member);
      state.events.push({
        id: createId('team-event'),
        type: 'team_added',
        userId: member.id,
        teamId,
        teamName: options.teamName || '',
        message: options.teamName ? `You were added to ${options.teamName}.` : 'You were added to a team.',
        createdAt: new Date().toISOString()
      });
    }
  });

  state.additions[teamId] = nextAdditions;
  writeState(state);
}

export function getTeamEventsForUser(userId) {
  const state = readState();
  return state.events
    .filter((event) => event.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function buildAssignablePeople(teamBundles = [], currentUser = null) {
  const people = [];

  teamBundles.forEach(({ members = [] }) => {
    members.forEach((member) => {
      if (currentUser && member.id === currentUser.id) return;
      people.push(snapshotUser(member, member.membershipRole || 'member'));
    });
  });

  return uniqueById(people);
}

export function isLocalTeam(teamId) {
  const state = readState();
  return state.customTeams.some((team) => team.id === teamId);
}

import { beforeEach, describe, expect, it } from "vitest";
import {
  getTeamDetail,
  getWorkspaceTeams
} from "../../../../frontend/js/utils/localTeams.js";

const STORAGE_KEY = "taskflow-local-team-state-v1";

const createLocalStorageDouble = () => {
  const store = new Map();

  return {
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    }
  };
};

describe("local team state helpers", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageDouble();
  });

  it("ignores and purges stale overrides/additions for backend-backed teams in the list view", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customTeams: [],
      overrides: {
        "team-1": {
          name: "Stale Override"
        }
      },
      additions: {
        "team-1": [
          {
            id: "ghost-1",
            membershipRole: "member"
          }
        ]
      },
      events: []
    }));

    const teams = getWorkspaceTeams([
      {
        id: "team-1",
        name: "Real Backend Team",
        description: "Canonical backend description.",
        memberCount: 3,
        managerCount: 1
      }
    ], { id: "manager-1" });

    expect(teams).toEqual([
      expect.objectContaining({
        id: "team-1",
        name: "Real Backend Team",
        description: "Canonical backend description.",
        memberCount: 3,
        managerCount: 1,
        isLocalTeam: false
      })
    ]);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual({
      customTeams: [],
      overrides: {},
      additions: {},
      events: []
    });
  });

  it("ignores stale overrides/additions for backend-backed teams in the detail view", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      customTeams: [],
      overrides: {
        "team-1": {
          name: "Stale Override"
        }
      },
      additions: {
        "team-1": [
          {
            id: "ghost-1",
            fullName: "Ghost User",
            membershipRole: "member"
          }
        ]
      },
      events: []
    }));

    const detail = getTeamDetail("team-1", {
      baseTeam: {
        id: "team-1",
        name: "Real Backend Team",
        description: "Canonical backend description.",
        memberCount: 2,
        managerCount: 1
      },
      baseMembers: [
        {
          id: "manager-1",
          fullName: "Manager One",
          membershipRole: "manager"
        },
        {
          id: "employee-1",
          fullName: "Employee One",
          membershipRole: "member"
        }
      ]
    });

    expect(detail.team).toEqual(expect.objectContaining({
      id: "team-1",
      name: "Real Backend Team",
      description: "Canonical backend description.",
      memberCount: 2,
      managerCount: 1,
      isLocalTeam: false
    }));
    expect(detail.members).toEqual([
      expect.objectContaining({
        id: "manager-1",
        fullName: "Manager One",
        membershipRole: "manager"
      }),
      expect.objectContaining({
        id: "employee-1",
        fullName: "Employee One",
        membershipRole: "member"
      })
    ]);
    expect(detail.members.find((member) => member.id === "ghost-1")).toBeUndefined();
  });
});

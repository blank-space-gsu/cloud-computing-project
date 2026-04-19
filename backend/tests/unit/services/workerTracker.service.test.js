import { describe, expect, it, vi } from "vitest";
import { getWorkerTrackerForUser } from "../../../src/services/workerTracker.service.js";

const managerUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "manager"
};

const employeeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "employee"
};

describe("worker tracker service", () => {
  it("blocks employees from accessing Worker Tracker", async () => {
    await expect(getWorkerTrackerForUser(employeeUser)).rejects.toMatchObject({
      statusCode: 403,
      code: "WORKER_TRACKER_FORBIDDEN"
    });
  });

  it("returns an empty tracker when there are no manageable teams", async () => {
    const listTeams = vi.fn().mockResolvedValue([]);
    const ensureGenerated = vi.fn().mockResolvedValue({
      generatedCount: 0
    });

    const tracker = await getWorkerTrackerForUser(
      managerUser,
      {},
      { listTeams, ensureGenerated }
    );

    expect(tracker.availableTeams).toEqual([]);
    expect(tracker.members).toEqual([]);
    expect(tracker.tasks).toEqual([]);
  });

  it("uses the first manageable team by default", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Ops",
        description: "Operations",
        memberCount: 3,
        managerCount: 1,
        canManageTeam: true
      }
    ]);
    const loadTeamSummary = vi.fn().mockResolvedValue({
      teamId: "team-1",
      completionPercent: 50
    });
    const ensureGenerated = vi.fn().mockResolvedValue({
      generatedCount: 0
    });
    const loadMembers = vi.fn().mockResolvedValue([]);
    const loadUnassignedTasks = vi.fn().mockResolvedValue([]);

    const tracker = await getWorkerTrackerForUser(
      managerUser,
      {},
      {
        listTeams,
        ensureGenerated,
        loadTeamSummary,
        loadMembers,
        loadUnassignedTasks
      }
    );

    expect(ensureGenerated).toHaveBeenCalledWith(managerUser, {
      teamId: "team-1"
    });
    expect(loadTeamSummary).toHaveBeenCalledWith({ teamId: "team-1" });
    expect(tracker.selectedTeamId).toBe("team-1");
    expect(tracker.summary.completionPercent).toBe(50);
  });

  it("rejects a selected team that is not manageable", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Ops",
        canManageTeam: true
      }
    ]);

    await expect(
      getWorkerTrackerForUser(
        managerUser,
        { teamId: "team-2" },
        { listTeams }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_NOT_FOUND"
    });
  });

  it("loads selected member tasks when memberUserId is provided", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Ops",
        description: "Operations",
        memberCount: 2,
        managerCount: 1,
        canManageTeam: true
      }
    ]);
    const loadTeamSummary = vi.fn().mockResolvedValue({
      teamId: "team-1",
      completionPercent: 50
    });
    const ensureGenerated = vi.fn().mockResolvedValue({
      generatedCount: 0
    });
    const loadMembers = vi.fn().mockResolvedValue([
      {
        userId: "member-1",
        fullName: "Ethan Employee"
      }
    ]);
    const loadTasksForMember = vi.fn().mockResolvedValue([
      {
        id: "task-1",
        title: "Prepare shift handoff"
      }
    ]);
    const loadUnassignedTasks = vi.fn().mockResolvedValue([]);

    const tracker = await getWorkerTrackerForUser(
      managerUser,
      {
        teamId: "team-1",
        memberUserId: "member-1"
      },
      {
        listTeams,
        ensureGenerated,
        loadTeamSummary,
        loadMembers,
        loadTasksForMember,
        loadUnassignedTasks
      }
    );

    expect(loadTasksForMember).toHaveBeenCalledWith({
      teamId: "team-1",
      memberUserId: "member-1"
    });
    expect(tracker.selectedMember.userId).toBe("member-1");
    expect(tracker.tasks).toHaveLength(1);
  });

  it("rejects a selected member that is not on the selected team", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1",
        name: "Ops",
        canManageTeam: true
      }
    ]);
    const loadTeamSummary = vi.fn().mockResolvedValue({
      teamId: "team-1",
      completionPercent: 0
    });
    const ensureGenerated = vi.fn().mockResolvedValue({
      generatedCount: 0
    });
    const loadMembers = vi.fn().mockResolvedValue([]);
    const loadUnassignedTasks = vi.fn().mockResolvedValue([]);

    await expect(
      getWorkerTrackerForUser(
        managerUser,
        {
          teamId: "team-1",
          memberUserId: "missing-member"
        },
        {
          listTeams,
          ensureGenerated,
          loadTeamSummary,
          loadMembers,
          loadUnassignedTasks
        }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_MEMBER_NOT_FOUND"
    });
  });
});

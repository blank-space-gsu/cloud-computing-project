import { describe, expect, it, vi } from "vitest";
import {
  createHoursLogForUser,
  listHoursLogsForUser
} from "../../../src/services/hoursLogged.service.js";

const employeeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "employee"
};

const managerUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "manager"
};

const sampleHoursLog = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: employeeUser.id,
  teamId: "44444444-4444-4444-8444-444444444444",
  taskId: "55555555-5555-4555-8555-555555555555",
  workDate: "2026-03-26",
  hours: 4
};

describe("hours logged service", () => {
  it("forces employee hours listing to their own user id", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: sampleHoursLog.teamId
    });
    const listHoursLogs = vi.fn().mockResolvedValue({
      hoursLogs: [],
      total: 0,
      summary: {
        entryCount: 0,
        totalHours: 0,
        currentWeekHours: 0,
        currentMonthHours: 0
      },
      charts: {
        byDate: []
      }
    });

    await listHoursLogsForUser(
      employeeUser,
      {
        teamId: sampleHoursLog.teamId,
        userId: managerUser.id
      },
      {
        findTeam,
        listHoursLogs
      }
    );

    expect(listHoursLogs).toHaveBeenCalledWith({
      actorUserId: employeeUser.id,
      actorAppRole: "employee",
      manageableTeamIds: [],
      filters: expect.objectContaining({
        userId: employeeUser.id
      })
    });
  });

  it("scopes manager hours listings to manageable teams", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: sampleHoursLog.teamId,
        canManageTeam: true
      },
      {
        id: "66666666-6666-4666-8666-666666666666",
        canManageTeam: false
      }
    ]);
    const listHoursLogs = vi.fn().mockResolvedValue({
      hoursLogs: [],
      total: 0,
      summary: {
        entryCount: 0,
        totalHours: 0,
        currentWeekHours: 0,
        currentMonthHours: 0
      },
      charts: {
        byDate: []
      }
    });

    await listHoursLogsForUser(
      managerUser,
      {},
      {
        listTeams,
        listHoursLogs
      }
    );

    expect(listHoursLogs).toHaveBeenCalledWith({
      actorUserId: managerUser.id,
      actorAppRole: "manager",
      manageableTeamIds: [sampleHoursLog.teamId],
      filters: expect.objectContaining({
        sortBy: "workDate",
        sortOrder: "desc"
      })
    });
  });

  it("creates an hours log for the authenticated user", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: sampleHoursLog.teamId
    });
    const findTask = vi.fn().mockResolvedValue({
      id: sampleHoursLog.taskId,
      teamId: sampleHoursLog.teamId
    });
    const insertHoursLog = vi.fn().mockResolvedValue(sampleHoursLog.id);
    const findHoursLog = vi.fn().mockResolvedValue(sampleHoursLog);

    const result = await createHoursLogForUser(
      employeeUser,
      {
        teamId: sampleHoursLog.teamId,
        taskId: sampleHoursLog.taskId,
        workDate: sampleHoursLog.workDate,
        hours: sampleHoursLog.hours,
        note: "Logged from service test"
      },
      {
        findTeam,
        findTask,
        insertHoursLog,
        findHoursLog
      }
    );

    expect(insertHoursLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: employeeUser.id,
        teamId: sampleHoursLog.teamId,
        taskId: sampleHoursLog.taskId,
        createdByUserId: employeeUser.id
      })
    );
    expect(result.id).toBe(sampleHoursLog.id);
  });

  it("rejects hours logs when the task and team do not match", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: sampleHoursLog.teamId
    });
    const findTask = vi.fn().mockResolvedValue({
      id: sampleHoursLog.taskId,
      teamId: "77777777-7777-4777-8777-777777777777"
    });

    await expect(
      createHoursLogForUser(
        employeeUser,
        {
          teamId: sampleHoursLog.teamId,
          taskId: sampleHoursLog.taskId,
          workDate: sampleHoursLog.workDate,
          hours: sampleHoursLog.hours
        },
        {
          findTeam,
          findTask
        }
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "HOURS_TASK_TEAM_MISMATCH"
    });
  });

  it("rejects manager hours creation for non-manageable teams", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: sampleHoursLog.teamId
    });
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: sampleHoursLog.teamId,
        canManageTeam: false
      }
    ]);

    await expect(
      createHoursLogForUser(
        managerUser,
        {
          teamId: sampleHoursLog.teamId,
          workDate: sampleHoursLog.workDate,
          hours: sampleHoursLog.hours
        },
        {
          findTeam,
          listTeams
        }
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "TEAM_NOT_FOUND"
    });
  });
});

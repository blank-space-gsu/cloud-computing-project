import { describe, expect, it, vi } from "vitest";
import {
  computeRecurringOccurrences,
  createRecurringTaskRuleForUser,
  ensureRecurringTasksGeneratedForUser
} from "../../../src/services/recurringTaskRule.service.js";

const managerUser = {
  id: "11111111-1111-4111-8111-111111111111",
  appRole: "manager"
};

const employeeUser = {
  id: "22222222-2222-4222-8222-222222222222",
  appRole: "employee"
};

describe("recurring task rule service", () => {
  it("computes daily occurrences across the requested window", () => {
    const occurrences = computeRecurringOccurrences(
      {
        frequency: "daily",
        startsOn: "2026-04-20",
        endsOn: null
      },
      {
        windowStartDate: "2026-04-20",
        windowEndDate: "2026-04-22"
      }
    );

    expect(occurrences).toEqual([
      "2026-04-20",
      "2026-04-21",
      "2026-04-22"
    ]);
  });

  it("computes weekly occurrences for selected weekdays", () => {
    const occurrences = computeRecurringOccurrences(
      {
        frequency: "weekly",
        startsOn: "2026-04-20",
        endsOn: null,
        weekdays: [1, 3]
      },
      {
        windowStartDate: "2026-04-20",
        windowEndDate: "2026-04-27"
      }
    );

    expect(occurrences).toEqual([
      "2026-04-20",
      "2026-04-22",
      "2026-04-27"
    ]);
  });

  it("skips monthly occurrences when the day does not exist in that month", () => {
    const occurrences = computeRecurringOccurrences(
      {
        frequency: "monthly",
        startsOn: "2026-04-01",
        endsOn: null,
        dayOfMonth: 31
      },
      {
        windowStartDate: "2026-04-01",
        windowEndDate: "2026-05-31"
      }
    );

    expect(occurrences).toEqual([
      "2026-05-31"
    ]);
  });

  it("creates recurring rules for manageable teams", async () => {
    const findTeam = vi.fn().mockResolvedValue({
      id: "team-1",
      membershipRole: "manager"
    });
    const insertRule = vi.fn().mockResolvedValue("rule-1");
    const findRule = vi.fn().mockResolvedValue({
      id: "rule-1",
      title: "Daily prep",
      frequency: "daily"
    });

    const result = await createRecurringTaskRuleForUser(
      managerUser,
      {
        teamId: "team-1",
        title: "Daily prep",
        frequency: "daily",
        dueTime: "09:00",
        startsOn: "2026-04-20"
      },
      {
        findTeam,
        insertRule,
        findRule
      }
    );

    expect(insertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        title: "Daily prep",
        frequency: "daily",
        priority: "medium",
        createdByUserId: managerUser.id
      })
    );
    expect(result.id).toBe("rule-1");
  });

  it("rejects recurring rule creation for employees", async () => {
    await expect(
      createRecurringTaskRuleForUser(employeeUser, {
        teamId: "team-1",
        title: "Daily prep",
        frequency: "daily",
        dueTime: "09:00",
        startsOn: "2026-04-20"
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "RECURRING_TASK_RULE_CREATION_FORBIDDEN"
    });
  });

  it("generates missing task instances and assignments for recurring rules", async () => {
    const listTeams = vi.fn().mockResolvedValue([
      {
        id: "team-1"
      }
    ]);
    const listRules = vi.fn().mockResolvedValue([
      {
        id: "rule-1",
        teamId: "team-1",
        title: "Daily prep",
        description: null,
        priority: "medium",
        defaultAssigneeUserId: "member-1",
        frequency: "daily",
        weekdays: null,
        dayOfMonth: null,
        dueTime: "09:00",
        startsOn: "2026-04-20",
        endsOn: null,
        createdByUserId: managerUser.id,
        updatedByUserId: managerUser.id
      }
    ]);
    const listGeneratedDates = vi.fn().mockResolvedValue([]);
    const findAssignee = vi.fn().mockResolvedValue({
      id: "member-1",
      appRole: "employee",
      isActive: true
    });
    const insertTask = vi.fn().mockResolvedValue("task-1");
    const insertTaskAssignment = vi.fn().mockResolvedValue("assignment-1");
    const insertTaskUpdate = vi.fn()
      .mockResolvedValueOnce("update-1")
      .mockResolvedValueOnce("update-2");
    const runTransaction = vi.fn().mockImplementation(async (work) => work({}));

    const result = await ensureRecurringTasksGeneratedForUser(
      managerUser,
      {
        teamId: "team-1",
        dateFrom: "2026-04-20",
        dateTo: "2026-04-20"
      },
      {
        listTeams,
        listRules,
        listGeneratedDates,
        findAssignee,
        insertTask,
        insertTaskAssignment,
        insertTaskUpdate,
        runTransaction
      }
    );

    expect(result.generatedCount).toBe(1);
    expect(insertTask).toHaveBeenCalledWith(
      expect.objectContaining({
        recurringRuleId: "rule-1",
        generatedForDate: "2026-04-20"
      }),
      {
        pool: {}
      }
    );
    expect(insertTaskAssignment).toHaveBeenCalled();
    expect(insertTaskUpdate).toHaveBeenCalledTimes(2);
  });
});

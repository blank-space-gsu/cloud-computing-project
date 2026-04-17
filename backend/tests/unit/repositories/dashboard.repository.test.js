import { describe, expect, it, vi } from "vitest";
import { getManagerDashboardSnapshot } from "../../../src/repositories/dashboard.repository.js";

describe("dashboard repository", () => {
  it("returns task-based workload members with completion and open-task counts", async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              total_task_count: "4",
              completed_task_count: "1",
              open_task_count: "3",
              overdue_task_count: "1",
              due_soon_task_count: "1",
              unassigned_task_count: "1",
              urgent_task_count: "1",
              average_progress_percent: "42.5"
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: "user-1",
              first_name: "Ethan",
              last_name: "Employee",
              job_title: "Specialist",
              assigned_task_count: "4",
              completed_task_count: "1",
              open_task_count: "3",
              in_progress_task_count: "1",
              blocked_task_count: "1",
              overdue_task_count: "1",
              total_estimated_hours: "12",
              open_estimated_hours: "8",
              average_progress_percent: "40"
            }
          ]
        })
        .mockResolvedValueOnce({
          rows: []
        })
        .mockResolvedValueOnce({
          rows: []
        })
    };

    const result = await getManagerDashboardSnapshot(
      {
        teamIds: ["team-1"]
      },
      { pool }
    );

    expect(result.summary.totalTaskCount).toBe(4);
    expect(result.charts.workloadByEmployee).toEqual([
      expect.objectContaining({
        userId: "user-1",
        taskCount: 4,
        assignedTaskCount: 4,
        completedTaskCount: 1,
        openTaskCount: 3,
        blockedTaskCount: 1,
        overdueTaskCount: 1,
        completionRate: 25
      })
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildGoalSummary,
  createEmptyGoalSummary
} from "../../../src/utils/goalSummary.js";

describe("goal summary helper", () => {
  it("returns a stable empty summary shape", () => {
    expect(createEmptyGoalSummary()).toEqual({
      totalGoalCount: 0,
      activeGoalCount: 0,
      cancelledGoalCount: 0,
      achievedGoalCount: 0,
      openGoalCount: 0,
      averageProgressPercent: 0,
      totalTargetValue: 0,
      totalActualValue: 0,
      primaryUnit: null,
      hasMixedUnits: false,
      totalsByUnit: []
    });
  });

  it("keeps aggregate totals when all visible goals share one unit", () => {
    const result = buildGoalSummary(
      {
        total_goal_count: "2",
        active_goal_count: "2",
        cancelled_goal_count: "0",
        achieved_goal_count: "1",
        open_goal_count: "1",
        average_progress_percent: "60.5"
      },
      [
        {
          unit: "USD",
          goal_count: "2",
          total_target_value: "15000",
          total_actual_value: "9100",
          achieved_goal_count: "1",
          active_goal_count: "2",
          open_goal_count: "1",
          average_progress_percent: "60.5"
        }
      ]
    );

    expect(result.primaryUnit).toBe("USD");
    expect(result.hasMixedUnits).toBe(false);
    expect(result.totalTargetValue).toBe(15000);
    expect(result.totalActualValue).toBe(9100);
    expect(result.totalsByUnit).toHaveLength(1);
  });

  it("nulls the combined totals when visible goals mix units", () => {
    const result = buildGoalSummary(
      {
        total_goal_count: "2",
        active_goal_count: "2",
        cancelled_goal_count: "0",
        achieved_goal_count: "0",
        open_goal_count: "2",
        average_progress_percent: "47.5"
      },
      [
        {
          unit: "USD",
          goal_count: "1",
          total_target_value: "15000",
          total_actual_value: "7200",
          achieved_goal_count: "0",
          active_goal_count: "1",
          open_goal_count: "1",
          average_progress_percent: "48"
        },
        {
          unit: "tasks",
          goal_count: "1",
          total_target_value: "40",
          total_actual_value: "26",
          achieved_goal_count: "0",
          active_goal_count: "1",
          open_goal_count: "1",
          average_progress_percent: "65"
        }
      ]
    );

    expect(result.primaryUnit).toBeNull();
    expect(result.hasMixedUnits).toBe(true);
    expect(result.totalTargetValue).toBeNull();
    expect(result.totalActualValue).toBeNull();
    expect(result.totalsByUnit).toEqual([
      expect.objectContaining({
        unit: "USD",
        totalTargetValue: 15000,
        totalActualValue: 7200
      }),
      expect.objectContaining({
        unit: "tasks",
        totalTargetValue: 40,
        totalActualValue: 26
      })
    ]);
  });
});

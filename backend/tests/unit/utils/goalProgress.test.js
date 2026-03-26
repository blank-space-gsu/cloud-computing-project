import { describe, expect, it } from "vitest";
import {
  buildGoalProgress,
  calculateGoalProgressPercent
} from "../../../src/utils/goalProgress.js";

describe("goal progress utils", () => {
  it("calculates progress percentage", () => {
    expect(calculateGoalProgressPercent(1000, 250)).toBe(25);
  });

  it("returns zero progress when the target value is invalid", () => {
    expect(calculateGoalProgressPercent(0, 250)).toBe(0);
  });

  it("builds derived goal progress fields", () => {
    expect(buildGoalProgress(1000, 1250)).toEqual({
      progressPercent: 125,
      isTargetMet: true,
      remainingValue: 0,
      excessValue: 250
    });
  });
});

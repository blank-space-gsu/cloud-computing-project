const normalizeNumber = (value) => Number(value ?? 0);

const mapTotalsByUnitRow = (row) => ({
  unit: row.unit,
  goalCount: normalizeNumber(row.goal_count),
  totalTargetValue: normalizeNumber(row.total_target_value),
  totalActualValue: normalizeNumber(row.total_actual_value),
  achievedGoalCount: normalizeNumber(row.achieved_goal_count),
  activeGoalCount: normalizeNumber(row.active_goal_count),
  openGoalCount: normalizeNumber(row.open_goal_count),
  averageProgressPercent: normalizeNumber(row.average_progress_percent)
});

export const createEmptyGoalSummary = () => ({
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

export const buildGoalSummary = (summaryRow = {}, totalsByUnitRows = []) => {
  const totalsByUnit = totalsByUnitRows.map(mapTotalsByUnitRow);
  const hasMixedUnits = totalsByUnit.length > 1;
  const primaryUnit = totalsByUnit.length === 1 ? totalsByUnit[0].unit : null;

  return {
    totalGoalCount: normalizeNumber(summaryRow.total_goal_count),
    activeGoalCount: normalizeNumber(summaryRow.active_goal_count),
    cancelledGoalCount: normalizeNumber(summaryRow.cancelled_goal_count),
    achievedGoalCount: normalizeNumber(summaryRow.achieved_goal_count),
    openGoalCount: normalizeNumber(summaryRow.open_goal_count),
    averageProgressPercent: normalizeNumber(summaryRow.average_progress_percent),
    totalTargetValue: hasMixedUnits
      ? null
      : (totalsByUnit[0]?.totalTargetValue ?? 0),
    totalActualValue: hasMixedUnits
      ? null
      : (totalsByUnit[0]?.totalActualValue ?? 0),
    primaryUnit,
    hasMixedUnits,
    totalsByUnit
  };
};

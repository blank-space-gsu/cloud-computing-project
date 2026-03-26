export const calculateGoalProgressPercent = (targetValue, actualValue) => {
  if (!targetValue || Number(targetValue) <= 0) {
    return 0;
  }

  return Number(((Number(actualValue) / Number(targetValue)) * 100).toFixed(2));
};

export const buildGoalProgress = (targetValue, actualValue) => {
  const normalizedTargetValue = Number(targetValue ?? 0);
  const normalizedActualValue = Number(actualValue ?? 0);

  return {
    progressPercent: calculateGoalProgressPercent(
      normalizedTargetValue,
      normalizedActualValue
    ),
    isTargetMet: normalizedActualValue >= normalizedTargetValue && normalizedTargetValue > 0,
    remainingValue: Math.max(normalizedTargetValue - normalizedActualValue, 0),
    excessValue: Math.max(normalizedActualValue - normalizedTargetValue, 0)
  };
};

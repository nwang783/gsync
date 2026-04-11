export function getPlanGoalTags(plan) {
  if (plan?.goalType === '2week') return ['2-week goal'];
  if (plan?.goalType === '3day') return ['3-day target'];
  return [];
}

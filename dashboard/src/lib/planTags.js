export function getPlanGoalTags(plan) {
  if (plan?.goalType === '2week') return ['2-week goal'];
  if (plan?.goalType === '3day') return ['3-day target'];
  const alignment = typeof plan?.alignment === 'string' ? plan.alignment.toLowerCase() : '';
  if (alignment.includes('2-week goal')) return ['2-week goal'];
  if (alignment.includes('3-day target')) return ['3-day target'];
  return [];
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function includesNormalized(haystack, needle) {
  if (!haystack || !needle) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

function getUpdatedAtMs(plan) {
  const updatedAt = plan?.updatedAt;
  if (!updatedAt) return 0;
  if (updatedAt instanceof Date) return updatedAt.getTime();
  if (typeof updatedAt.toDate === 'function') return updatedAt.toDate().getTime();
  if (typeof updatedAt.seconds === 'number') return updatedAt.seconds * 1000;
  if (typeof updatedAt === 'number') return updatedAt;
  return 0;
}

export function getPlanGoalTags(plan) {
  const alignment = normalizeText(plan?.alignment);
  const summary = normalizeText(plan?.summary);
  const slug = normalizeText(plan?.slug || plan?.id);
  const tags = [];

  if (
    alignment.includes('2-week goal') ||
    alignment.includes('two-week goal') ||
    summary.includes('2-week goal') ||
    slug.includes('2week')
  ) {
    tags.push('2-week goal');
  }

  if (
    alignment.includes('3-day target') ||
    alignment.includes('three-day target') ||
    summary.includes('3-day target') ||
    slug.includes('3day')
  ) {
    tags.push('3-day target');
  }

  return tags;
}

export function findGoalLinkedPlan(plans, goalType, goalContent) {
  const label = goalType === '2week' ? '2-week goal' : '3-day target';
  const alternate = goalType === '2week' ? 'two-week goal' : 'three-day target';
  const goalText = normalizeText(goalContent);

  const scored = (plans || [])
    .map((plan) => {
      const alignment = normalizeText(plan.alignment);
      const summary = normalizeText(plan.summary);
      const slug = normalizeText(plan.slug || plan.id);
      let score = 0;

      if (alignment.includes(label)) score += 6;
      if (alignment.includes(alternate)) score += 6;
      if (summary.includes(label)) score += 3;
      if (summary.includes(alternate)) score += 3;
      if (slug.includes(goalType)) score += 2;
      if (goalText && includesNormalized(plan.alignment, goalText)) score += 8;
      if (goalText && includesNormalized(plan.summary, goalText)) score += 2;

      return { plan, score };
    })
    .filter((entry) => entry.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return getUpdatedAtMs(b.plan) - getUpdatedAtMs(a.plan);
  });

  return scored[0]?.plan || null;
}

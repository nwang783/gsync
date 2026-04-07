function parseFrontmatterValue(raw) {
  const value = raw.trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

export function normalizeTouches(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePlanFile(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { metadata: {}, markdown: normalized.trim() };
  }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) {
    return { metadata: {}, markdown: normalized.trim() };
  }

  const frontmatter = normalized.slice(4, end).split('\n');
  const metadata = {};

  for (const line of frontmatter) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = parseFrontmatterValue(line.slice(separator + 1));
    metadata[key] = value;
  }

  if (metadata.touches) {
    metadata.touches = normalizeTouches(metadata.touches);
  }

  return {
    metadata,
    markdown: normalized.slice(end + 5).trim(),
  };
}

export function buildPulledPlanFile(summary, content) {
  const lines = ['---'];
  const fields = {
    id: summary.id,
    slug: summary.slug || '',
    summary: summary.summary || '',
    status: summary.status || '',
    author: summary.author || '',
    revision: content?.revision ?? summary.revision ?? 0,
    alignment: summary.alignment || '',
    outOfScope: summary.outOfScope || '',
    touches: (summary.touches || []).join(', '),
    prUrl: summary.prUrl || '',
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value === '' || value == null) continue;
    lines.push(`${key}: ${value}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(content?.markdown || '');
  return lines.join('\n').trimEnd() + '\n';
}

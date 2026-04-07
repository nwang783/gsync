import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPulledPlanFile, normalizeTouches, parsePlanFile } from '../src/plan-file.js';
import { generateContext } from '../src/context.js';

test('parsePlanFile reads simple frontmatter and markdown body', () => {
  const input = `---
id: abc123
summary: Ship lazy pull
revision: 3
touches: src/cli.js, src/firestore.js
---

# Plan

Real markdown body.
`;

  const parsed = parsePlanFile(input);
  assert.equal(parsed.metadata.id, 'abc123');
  assert.equal(parsed.metadata.summary, 'Ship lazy pull');
  assert.equal(parsed.metadata.revision, 3);
  assert.deepEqual(parsed.metadata.touches, ['src/cli.js', 'src/firestore.js']);
  assert.match(parsed.markdown, /# Plan/);
});

test('normalizeTouches handles arrays and comma-separated strings', () => {
  assert.deepEqual(normalizeTouches('a, b, c'), ['a', 'b', 'c']);
  assert.deepEqual(normalizeTouches(['a', ' b ']), ['a', 'b']);
  assert.deepEqual(normalizeTouches(''), []);
});

test('buildPulledPlanFile emits agent-friendly frontmatter with raw markdown body', () => {
  const output = buildPulledPlanFile(
    {
      id: 'plan1',
      slug: 'lazy-pull',
      summary: 'Lazy pull summaries first',
      status: 'in-progress',
      author: 'Nathan',
      alignment: 'Ship agent-safe sync',
      outOfScope: 'Drift warnings',
      touches: ['src/cli.js', 'src/firestore.js'],
    },
    { revision: 2, markdown: '# Heading\n\nBody text.' },
  );

  assert.match(output, /^---\nid: plan1/m);
  assert.match(output, /revision: 2/);
  assert.match(output, /touches: src\/cli\.js, src\/firestore\.js/);
  assert.match(output, /\n# Heading\n\nBody text\.\n$/);
});

test('generateContext includes summary routing data without requiring full plan bodies', () => {
  const context = generateContext(
    { content: 'Ship coordination wedge' },
    { content: 'Land lazy pulls' },
    [
      {
        id: 'plan1',
        author: 'Nathan',
        slug: 'lazy-pull',
        status: 'in-progress',
        updatedAt: new Date(),
        summary: 'Summaries first',
        alignment: 'Supports 3-day target',
        touches: ['src/cli.js'],
        outOfScope: 'History UI',
        revision: 2,
      },
    ],
    [],
  );

  assert.match(context, /## 2-Week Goal/);
  assert.match(context, /Revision: 2/);
  assert.match(context, /Summaries first/);
  assert.doesNotMatch(context, /No canonical markdown body yet/);
});

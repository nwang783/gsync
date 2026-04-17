export const INSTALL_PROMPT = `Read https://github.com/nwang783/gsync/blob/main/SKILL.md, then run gsync status and gsync sync --last 20 before you scope the task.`;

export const HERO_FACTS = [
  {
    label: '2-week goal',
    value: 'Sprint-level direction every seat can read before coding starts.',
  },
  {
    label: '3-day target',
    value: 'Short-horizon focus for what has to land next.',
  },
  {
    label: 'seat auth',
    value: 'Seat keys keep returning users signed in, while join codes onboard new teammates in the CLI or dashboard.',
  },
  {
    label: 'planning split',
    value: 'Use gstack for planning. Use gsync to keep the team aligned.',
  },
];

export const HERO_TERMINAL_LINES = [
  { tone: 'cmd', text: '$ gsync status' },
  { tone: 'dim', text: 'seat authenticated · cached context available' },
  { tone: 'cmd', text: '$ gsync sync --last 20' },
  { tone: 'success', text: '✓ 2-week goal loaded' },
  { tone: 'success', text: '✓ 3-day target loaded' },
  { tone: 'success', text: '✓ active plan summaries indexed' },
  { tone: 'cmd', text: '$ cat ~/.gsync/CONTEXT.md' },
  { tone: 'accent', text: '→ every human and agent starts from the same intent' },
];

export const WORKFLOW_STEPS = [
  {
    id: 'sync',
    number: '01',
    kicker: 'Read the room',
    title: 'Sync the shared context before an agent touches code.',
    body: 'Start with gsync status and gsync sync --last 20 so the session begins with the team goal, short-horizon target, and current plan summaries instead of stale assumptions.',
    detail: 'gsync writes a fresh CONTEXT.md and a summary index locally. You only pull full plan bodies when the summaries say they matter.',
    tags: ['team goals', 'active summaries', 'local cache'],
    previewTitle: 'session bootstrap',
    previewLines: [
      { tone: 'cmd', text: '$ gsync status' },
      { tone: 'dim', text: 'cached summary index found' },
      { tone: 'cmd', text: '$ gsync sync --last 20' },
      { tone: 'success', text: '✓ CONTEXT.md refreshed' },
      { tone: 'accent', text: '→ summary context ready for agent ingestion' },
    ],
    footer: 'shared context first',
  },
  {
    id: 'pull',
    number: '02',
    kicker: 'Pull only what is relevant',
    title: 'Inspect the plans that actually touch your surface area.',
    body: 'The summary index tells you who owns what, which files they expect to touch, and whether the work is active, in review, or merged. Pull a full markdown plan only if it intersects your task.',
    detail: 'That keeps the local context lightweight while still giving agents canonical plan bodies when there is real overlap to reason about.',
    tags: ['touched surfaces', 'plan bodies', 'local markdown'],
    previewTitle: 'targeted context pull',
    previewLines: [
      { tone: 'cmd', text: '$ gsync plan pull plan-042' },
      { tone: 'success', text: '✓ canonical markdown cached locally' },
      { tone: 'dim', text: '~/.gsync/plans/presence-layer--plan-042.md' },
      { tone: 'accent', text: '→ deeper context without syncing every plan file' },
    ],
    footer: 'pull on demand',
  },
  {
    id: 'publish',
    number: '03',
    kicker: 'Publish intent',
    title: 'Push your plan before teammates discover it from a diff.',
    body: 'Register the markdown plan as the canonical artifact so the rest of the team can see summary, alignment, out-of-scope boundaries, and touched files before implementation diverges.',
    detail: 'The best summaries describe the concrete artifact being built and the exact directories or files you expect to edit. The point is coordination, not decoration.',
    tags: ['canonical markdown', 'alignment', 'touches'],
    previewTitle: 'plan registration',
    previewLines: [
      { tone: 'cmd', text: '$ gsync plan push my-plan.md' },
      { tone: 'success', text: '✓ summary doc updated' },
      { tone: 'success', text: '✓ canonical body cached back locally' },
      { tone: 'accent', text: '→ teammates can route around collisions early' },
    ],
    footer: 'make the work visible',
  },
  {
    id: 'close',
    number: '04',
    kicker: 'Close the loop',
    title: 'Attach review context, then mark the plan merged when the code lands.',
    body: 'Progress notes, PR linkage, and the final merged status keep the coordination loop honest. The next agent should inherit the actual state of the work, not a half-finished story.',
    detail: 'Git stores code history. gsync stores what the team was trying to do, why it mattered, and when the loop is actually complete.',
    tags: ['review link', 'status updates', 'merged context'],
    previewTitle: 'context after shipping',
    previewLines: [
      { tone: 'cmd', text: '$ gsync plan review <id> --pr <url>' },
      { tone: 'success', text: '✓ review URL attached' },
      { tone: 'cmd', text: '$ gsync plan merged <id>' },
      { tone: 'accent', text: '→ the next session starts from the updated truth' },
    ],
    footer: 'keep the index honest',
  },
];

export const COMMAND_CHECKLIST = [
  {
    command: 'gsync status',
    note: 'Check the cached context before you refresh the session.',
  },
  {
    command: 'gsync sync --last 20',
    note: 'Pull the current goals and plan summaries into CONTEXT.md.',
  },
  {
    command: 'gsync plan pull <id>',
    note: 'Only fetch the full markdown plan when the summary intersects your work.',
  },
  {
    command: 'gsync plan push my-plan.md',
    note: 'Publish the canonical markdown plan before the implementation drifts.',
  },
  {
    command: 'gsync plan merged <id>',
    note: 'Close the loop once the code lands so the next session starts clean.',
  },
];

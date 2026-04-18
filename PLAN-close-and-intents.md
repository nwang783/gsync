# gsync Feature Plan: Plan Closing & Intents System (V1)

> **Authors:** rdlekuch
> **Status:** Implemented
> **Branch:** `feat/close-and-intents`

---

## Context

gsync V1 is a repo-native file-based context system — no Firebase, no CLI binary, no dashboard, no backend. Context lives as markdown files in `.gsync/` directories within each project repo. Agents interact with gsync by reading/writing local files following skill-defined conventions.

This plan covers two features redesigned from the original Firebase prototype to work natively with V1's file-based, skill-driven architecture.

---

## Feature A: Plan Closing / Archiving

### Problem

Plans are markdown files in the activity collection. There's no lifecycle — a plan file just exists or doesn't. Stale, obsolete, or superseded plans sit alongside active ones, cluttering agent context.

### Solution

Plan lifecycle expressed through YAML frontmatter + archive subdirectory:

1. **Frontmatter `status` field** — `active` (default) or `closed`, plus `closed_date` and `closed_reason`
2. **Archive directory** — closed plans move to `.gsync/data/activity/archive/` so agents scanning for active plans only see the root directory

```yaml
---
status: closed
summary: Refactor auth module to use JWT
touches: [src/auth/jwt.ts, src/middleware/auth.ts]
created: 2026-04-08
closed_date: 2026-04-10
closed_reason: Completed and merged in PR #42
---
```

### Rules

- Never delete plan files — always close and archive
- A plan without a `status` field is treated as active (backward compatible)
- Frontmatter `status` is the source of truth regardless of file location
- Only scan activity root for active plans, not `archive/`

---

## Feature B: Intents System

### Problem

When someone thinks "I should build X eventually," that thought has nowhere to go. They either create a premature plan or say nothing, leading to duplicated work.

### Solution

Intents are lightweight pre-plan signals stored as `intent-<slug>.md` files in `.gsync/data/activity/intents/`:

```yaml
---
status: open
summary: Speed up CI builds by parallelizing test suites
touches: [.github/workflows/ci.yml, jest.config.ts]
created: 2026-04-10
claimed_by:
claimed_note:
---

Optional longer description or context here.
```

### Intent Lifecycle

```
open → claimed → closed
  │                 ↑
  └─────────────────┘  (can close directly)
```

- `open` — available, no one working on it
- `claimed` — someone is actively starting work (with a required note, max 150 chars)
- `closed` — fulfilled by a plan or no longer relevant

### Rules

- Anyone can create intents, anyone can claim open intents
- `claimed` means "do not duplicate without coordinating"
- Closed intents stay in `intents/` (not archived — they're small)
- Agents must check intents before creating new plans (overlap check)

---

## Overlap Matching

Before creating a new plan, agents read all open/claimed intent files and check for:
- Shared key terms in `summary` fields
- Overlapping entries in `touches` arrays

This is judgment-based, not algorithmic. The agent flags potential overlaps to the user and asks whether the plan fulfills, extends, or is unrelated to each matching intent.

---

## Activity Collection Structure

```
.gsync/data/activity/
  activity.md                    # collection doc
  refactor-auth.md               # active plan
  migrate-db.md                  # active plan
  intents/
    intent-faster-builds.md      # open intent
    intent-dark-mode.md          # claimed intent
  archive/
    old-feature.md               # closed plan
```

---

## Implementation

All behavior is defined through skill instructions — no code, no infrastructure.

### Files Modified

1. **`skills/gsync/SKILL.md`** — Added three sections: Plan Lifecycle, Intents, Overlap Check Before Plan Creation. Updated Required Workflow (added step 6: check intents) and example activity collection doc.

2. **`skills/gsync-onboarding/SKILL.md`** — Updated recommended `activity.md` draft with intent files, archive conventions, and plan/intent lifecycle sections. Updated starter `GSYNC.md` draft with collection conventions.

3. **`README.md`** — Added plan lifecycle and intents to V1 feature list.

### No New Files at Repo Level

`intents/` and `archive/` directories are created at runtime by agents following skill instructions in target projects. No config.json schema changes needed.

---

## Verification

Read both skills as a fresh agent and verify:

- [ ] Following Plan Lifecycle instructions, an agent can close a plan (set frontmatter, move to archive)
- [ ] Following Intents instructions, an agent can create, claim, and close intents
- [ ] Following Overlap Check instructions, an agent creating a plan checks intents first
- [ ] The onboarding skill's `activity.md` draft mentions intents and archive conventions
- [ ] The starter `GSYNC.md` draft mentions plan lifecycle and intents in collection conventions

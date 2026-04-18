# gsync

`gsync` is a repo-native context system for coding agents.

V1 is intentionally small:

- a reusable steady-state `GSYNC` skill
- a reusable `gsync-onboarding` skill
- a minimal `.gsync/config.json` contract
- project-local docs that tell agents how this repo uses `gsync`
- plan lifecycle (active/closed with archive) and intents (lightweight pre-plan coordination signals)

The old Firebase prototype is preserved in [legacy/firebase-prototype](/Users/nathanwang/Projects/nomergeconflicts/legacy/firebase-prototype).

## Repo Layout

```text
skills/
  gsync/
  gsync-onboarding/
legacy/
  firebase-prototype/
```

## Skills

### `GSYNC`

Use [skills/gsync/SKILL.md](/Users/nathanwang/Projects/nomergeconflicts/skills/gsync/SKILL.md) when a repo already has `.gsync/` and the agent needs to work within it.

### `gsync-onboarding`

Use [skills/gsync-onboarding/SKILL.md](/Users/nathanwang/Projects/nomergeconflicts/skills/gsync-onboarding/SKILL.md) when a repo needs `.gsync/` initialized or extended with new collections.

The onboarding skill should be sufficient on its own. The intended setup path is:

1. install or load `gsync-onboarding`
2. let the agent explain `gsync` briefly
3. let the agent draft `.gsync/config.json`, `.gsync/GSYNC.md`, and collection docs
4. hand off future operation to `GSYNC`

## Contract

V1 keeps one hard machine-readable contract:

```json
{
  "version": 1,
  "collections": {
    "activity": {
      "path": ".gsync/data/activity",
      "doc": ".gsync/data/activity/activity.md"
    }
  }
}
```

Everything else is project-local and should be documented in:

- `.gsync/GSYNC.md`
- each collection's configured doc file

## Spec

The rewrite source of truth is [V1_REWRITE_SPEC.md](/Users/nathanwang/Projects/nomergeconflicts/V1_REWRITE_SPEC.md).

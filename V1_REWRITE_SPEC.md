# gsync V1 Rewrite Spec

## Goal

Rewrite `gsync` from a Firebase-centric coordination app into a repo-native agent convention system.

V1 is not a hosted product. V1 is:

- one reusable steady-state skill
- one reusable onboarding skill
- one small machine-readable config contract
- repo-local docs that tell agents how this project uses `gsync`

The current codebase should be preserved under `/legacy` rather than deleted, then replaced with the new V1 shape.

## Product Position

`gsync` is a repo-native context layer for agents.

It gives a project:

- a shared place to keep agent-readable coordination and context
- local conventions for how different kinds of context are stored
- a portable skill that can be used in Codex or Claude Code repos

It does not require:

- Firebase
- a hosted backend
- a summary compiler
- a dashboard
- a user-facing CLI

## Core Principles

1. `.gsync/` is project-local and canonical.
2. The `GSYNC` skill is generic and reusable across repos.
3. `.gsync/GSYNC.md` is project-specific and hand-authored by the agent.
4. `.gsync/config.json` is the only required machine-readable contract.
5. Each collection is self-describing through its own doc file.
6. Agents should draft setup content for the user instead of making the user fill blank forms.
7. V1 is raw-first. There is no universal summary abstraction.
8. No collection is primary. Agents decide relevance by reading config and docs.

## V1 Deliverables

V1 should ship:

- a generic `GSYNC` skill
- a generic `gsync-onboarding` skill
- a minimal repo layout for target repos

V1 should not depend on:

- Firebase code
- dashboard code
- auth flows
- hosted sync
- required CLI commands
- repo-local setup scripts

## Skills

### 1. `GSYNC`

Purpose:

- operate inside an existing `.gsync/` system
- read and write collection data correctly
- respect project-local conventions

Required behavior:

1. Read `.gsync/config.json`
2. Read `.gsync/GSYNC.md`
3. Read the relevant collection doc files
4. Only then read or write collection data

Rules:

- do not silently reinitialize `.gsync/`
- do not silently add new collections
- do not invent file structure not declared or described by the project
- do not assume `activity`, `company`, or any other collection exists unless config says so
- if a task needs a new collection or new convention, flag that and route to onboarding or explicit user approval

### 2. `gsync-onboarding`

Purpose:

- initialize `.gsync/` in a repo
- extend `.gsync/` with new collections later
- explain the system briefly
- install or point the user to the `GSYNC` skill when setup is complete

Required behavior:

- start with a short explanation of what `gsync` is
- recommend `activity` and `company` as starter collections, with reasons
- draft answers and file contents for the user
- ask for confirm/change instead of asking the user to author everything manually
- write `.gsync/config.json`, `.gsync/GSYNC.md`, collection folders, and collection docs
- be self-sufficient; do not require a helper script to initialize the repo

Rules:

- optimize for the smallest viable setup
- do not require a complete taxonomy up front
- default to one or two useful collections, then stop

## Target Repo Layout

Target repos using `gsync` should look like this:

```text
.gsync/
  config.json
  GSYNC.md
  data/
    activity/
      activity.md
      plans/
    company/
      company.md
```

This is only an example. V1 must not hardcode that exact structure.

The required rule is:

- `.gsync/config.json` declares collections
- each declared collection has a path
- each declared collection has a doc file

Everything else is project-defined.

## Machine-Readable Contract

### `.gsync/config.json`

This is the only required machine-readable file.

Minimum schema:

```json
{
  "version": 1,
  "collections": {
    "activity": {
      "path": ".gsync/data/activity",
      "doc": ".gsync/data/activity/activity.md"
    },
    "company": {
      "path": ".gsync/data/company",
      "doc": ".gsync/data/company/company.md"
    }
  }
}
```

Required fields:

- `version`
- `collections`
- for each collection:
  - `path`
  - `doc`

Optional fields allowed in V1:

- `description`
- `scripts`
- `examples`

Example with optional fields:

```json
{
  "version": 1,
  "collections": {
    "activity": {
      "path": ".gsync/data/activity",
      "doc": ".gsync/data/activity/activity.md",
      "description": "Developer coordination artifacts such as plans and work notes.",
      "scripts": [
        ".gsync/data/activity/scripts/normalize-plans.mjs"
      ],
      "examples": [
        ".gsync/data/activity/plans/example-plan.md"
      ]
    }
  }
}
```

V1 config constraints:

- collection keys are stable identifiers
- paths are repo-relative
- docs are repo-relative
- config must not imply a required subfolder structure beyond what the project declares
- agents should be able to author this file directly from the onboarding skill

## Project Doc Contract

### `.gsync/GSYNC.md`

`GSYNC.md` is project-specific and hand-authored by the agent during onboarding.

It must include these sections:

1. Purpose
   - why this repo uses `gsync`
   - what problems it is solving here

2. Collections
   - the collections that currently exist
   - what each one is for

3. Agent Workflow
   - what agents should read first
   - how agents decide which collections are relevant
   - how agents should behave before writing data

4. Collection Conventions
   - the high-level conventions for each collection
   - what kinds of artifacts exist there

5. Guardrails
   - what agents should not do
   - what changes require user confirmation

6. Not Yet Implemented
   - which things are intentionally deferred
   - examples: summaries, processors, dashboards, extra collections

Recommended sections:

- Example tasks
- Review expectations
- Optional local scripts

### Collection Doc Contract

Each collection doc must exist at the configured `doc` path.

Each collection doc must include these sections:

1. Purpose
   - what data belongs in this collection

2. Canonical Artifacts
   - what file types or artifact types agents should create or update

3. Read Before Writing
   - what agents should inspect before adding new data

4. Write Conventions
   - naming conventions
   - formatting rules
   - any file placement rules

5. Scripts and Automation
   - optional scripts tied to this collection
   - what they do and when to use them

6. Avoid
   - behaviors agents should avoid in this collection

Recommended sections:

- Examples
- Open questions
- Future processors

## Recommended Starter Collections

The onboarding skill should recommend these by default.

### `activity`

Why recommend it:

- gives the repo an immediate developer-sync substrate
- creates immediate value with minimal abstraction
- supports the original wedge of reducing drift between contributors

Suggested default convention:

- plan files
- optional coordination notes if the repo wants them later

V1 default:

- `activity` is just plan files
- no summary compiler
- no forced metadata format beyond project-local conventions

### `company`

Why recommend it:

- gives agents broader product and business context
- prevents planning in a vacuum
- supports founder notes, strategy, decisions, and related context

Suggested default convention:

- markdown notes
- decision records
- strategy context

### Optional later collections

The onboarding skill may suggest but should not default to:

- `transcripts`
- `research`
- `security`
- `qa`

These should only be initialized when the repo has an actual near-term use for them.

## Standard Question Set Per Collection

When onboarding adds a collection, the agent should use the same question set every time.

The agent should draft answers first, then ask for confirm/change.

Questions:

1. What should this collection be called?
2. What kind of data belongs here?
3. What are the canonical artifact types for this collection?
4. What should agents read before writing here?
5. What naming or formatting conventions should agents follow?
6. Are there scripts tied to this collection?
7. What should agents avoid doing in this collection?
8. Are there example files worth referencing?

The user should not need to type complete answers unless the draft is wrong.

## Onboarding Flow

The onboarding skill should follow this sequence.

### Step 1. Brief Explanation

Explain `gsync` briefly:

- it is a repo-native context system for agents
- it uses `.gsync/` in the repo
- it is configured by local docs and config
- it helps agents share context and follow project conventions

### Step 2. Recommend Starter Collections

Recommend:

- `activity` because it gives immediate developer-sync value
- `company` because it gives broader planning context

The skill should explain why each is useful and ask whether to initialize them.

### Step 3. Draft Collection Definitions

For each collection:

- propose name
- propose path
- propose doc path
- propose purpose
- propose artifact conventions
- propose guardrails

The agent should ask for confirm/change, not free-form authoring.

### Step 4. Write Project Files

Write:

- `.gsync/config.json`
- `.gsync/GSYNC.md`
- collection folders
- collection docs

Optional:

- example files

### Step 5. Install or Surface `GSYNC`

At the end of onboarding:

- install the reusable steady-state `GSYNC` skill if the environment supports installation
- otherwise point the user and future agents at the skill path and usage instructions

### Step 6. Stop

Do not keep expanding the system unless the user asks.

## Draft-First Authoring Rules

The onboarding skill should minimize user typing.

Rules:

- infer reasonable defaults from repo name, README, and user request
- write the first draft yourself
- ask for approval or small corrections
- only ask open-ended questions when a wrong guess would be risky

Bad onboarding:

- asking the user to fill every field from scratch
- asking for a complete taxonomy on day one
- demanding a “perfect” information architecture before setup

Good onboarding:

- “I recommend `activity` and `company`; here is why”
- “I drafted the config and docs below; confirm or change”
- “I assumed `activity` uses plan files; confirm or change”

## Activity V1 Convention

V1 recommendation:

- `activity` stores plan files
- summaries are deferred
- processors are deferred
- dashboards are deferred

Suggested default shape:

```text
.gsync/data/activity/
  activity.md
  plans/
    example-plan.md
```

This is a recommendation, not a hard requirement. The project can choose a different artifact layout if it is documented in the collection doc.

## Rewrite Strategy For This Repo

This repo should be rewritten in place with the old implementation preserved in `/legacy`.

### Target root shape

```text
legacy/
  firebase-prototype/
skills/
  gsync/
  gsync-onboarding/
README.md
```

### Legacy policy

Move current implementation artifacts under `/legacy/firebase-prototype/`, including:

- current CLI code
- Firebase functions
- dashboard
- legacy tests
- legacy skill text

Keep only the files needed for the new V1 at the repo root.

### Rewrite order

1. Preserve old implementation under `/legacy`
2. Replace root README with V1 positioning
3. Add the new steady-state `GSYNC` skill
4. Add `gsync-onboarding` skill
5. Keep setup logic and starter drafts inside the onboarding skill

## Non-Goals

V1 will not solve:

- multi-user auth
- hosted sync
- dashboards
- collection summarization
- universal file schemas across all collections
- complex automation

Those can be added later if real usage demands them.

## Acceptance Criteria

V1 is complete when:

- a repo can be initialized with `.gsync/` using the onboarding skill
- the onboarding skill recommends `activity` and `company` with reasons
- the onboarding skill drafts answers instead of making the user write everything
- the resulting repo contains `config.json`, `GSYNC.md`, and collection docs
- the steady-state `GSYNC` skill can operate by reading those files
- no Firebase or hosted backend is required for the core workflow
- this repo preserves the old implementation under `/legacy`

## Immediate Next Step

Implement the rewrite in two phases:

1. Spec lock:
   - finalize this document
   - turn it into the source of truth for the rewrite

2. Rewrite:
   - move current implementation into `/legacy`
   - rebuild the repo around the two-skill model

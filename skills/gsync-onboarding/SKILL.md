---
name: gsync-onboarding
description: Tell the user what gsync is for, initialize or extend `.gsync/`, draft the setup content, and write the initial config and docs. This skill is written for the agent running onboarding.
---

# gsync-onboarding

## What gsync Is For

When the user asks to set up gsync, explain it briefly in agent terms.

`gsync` exists to solve two problems:

- developer sync: agents and humans drift when current intent is not legible enough
- broader context: important product, company, and planning context often stays outside the code unless it is stored somewhere durable

`gsync` gives agents a project-local context system so they can:

- see what kinds of context exist
- know where that context lives
- follow local conventions before writing new artifacts
- share context through project-local files instead of hidden chat state

Do not explain it like marketing copy. Explain it like operating context for agents.

## What This Skill Does

Use this skill when:

- the current project does not have `.gsync/` yet
- the current project needs a new collection added
- the current project wants to refresh or extend its gsync setup

This skill sets up the system. After setup, future work should use the steady-state `GSYNC` skill.

## How To Talk To The User

Keep the introduction short. Cover these points:

- `gsync` is a project-local context system for agents
- it stores its setup in `.gsync/`
- `.gsync/config.json` declares collections
- `.gsync/GSYNC.md` explains how the current project uses the system
- each collection has its own doc describing local conventions

Then move into draft-first setup.

## Default Recommendations

Recommend these starter collections by default:

- `activity`: useful immediately for developer sync, plans, and current work artifacts
- `company`: useful for broader product, strategy, and decision context

Explain why you recommend them, then ask for confirm/change.

Do not require them if the current project clearly needs something else.

## Draft-First Rule

Your job is to draft the setup so the user does not have to type everything out.

For every collection:

- infer a reasonable first draft
- propose the collection name, path, and doc path
- propose its purpose
- propose its artifact conventions
- propose guardrails
- ask the user to confirm or change the draft

Do not ask the user to author the whole system from scratch unless the draft would be too risky.

When possible, infer defaults from:

- the user's request
- the current codebase
- the README or other local docs
- obvious naming conventions

## Standard Question Set Per Collection

Use the same question set for every collection:

1. What should the collection be called?
2. What kind of data belongs here?
3. What are the canonical artifact types?
4. What should agents read before writing here?
5. What naming or formatting conventions should agents follow?
6. Are there scripts tied to this collection?
7. What should agents avoid doing here?
8. Are there example files worth pointing to?

Draft answers first. Ask for confirm/change second.

## Files To Write

When initializing `.gsync/`, write:

- `.gsync/config.json`
- `.gsync/GSYNC.md`
- each configured collection folder
- each configured collection doc file

Also update `AGENTS.md` with a short gsync section so future agents know:

- this project uses gsync
- `.gsync/config.json` declares collections
- `.gsync/GSYNC.md` explains the high-level system
- collection docs define local conventions
- agents should read those files before writing gsync data

Optionally write:

- example files

Do not keep adding structure once the smallest viable setup is in place.

## Starter Drafts

Unless the user wants something materially different, start from these drafts and customize them for the current project.

### Starter `config.json`

```json
{
  "version": 1,
  "collections": {
    "activity": {
      "path": ".gsync/data/activity",
      "doc": ".gsync/data/activity/activity.md",
      "description": "Developer coordination artifacts such as plans and active work notes."
    },
    "company": {
      "path": ".gsync/data/company",
      "doc": ".gsync/data/company/company.md",
      "description": "Company, product, strategy, and decision context for agents."
    }
  }
}
```

If the setup should start smaller, remove `company` and keep only `activity`.

### Starter `GSYNC.md`

```md
# GSYNC

## Purpose

This project uses `gsync` to keep agent-readable context in the working tree itself.

## Collections

- `activity`: developer coordination artifacts such as plans and active work notes
- `company`: broader product, strategy, and decision context for agents

## Agent Workflow

1. Read `.gsync/config.json`
2. Read this file
3. Read the relevant collection doc file(s)
4. Only then read or write collection data

## Collection Conventions

- `activity` is for current work context and plan artifacts
- `company` is for broader context that should inform planning and execution

## Guardrails

- do not invent new collection structure without updating docs
- do not silently add collections
- ask before changing core conventions

## Not Yet Implemented

- universal summaries
- collection processors
- dashboards
- extra automation
```

### Starter `AGENTS.md` Addition

Add a short section like this to the project's `AGENTS.md`:

```md
## gsync

This project uses `gsync` for agent-readable context.

Before reading or writing gsync data:

1. Read `.gsync/config.json`
2. Read `.gsync/GSYNC.md`
3. Read the relevant collection doc file(s)

Do not invent new collection structure silently. If a new collection or convention is needed, ask first.
```

### Starter Collection Doc Shape

Use this structure for each collection doc and then customize it to the collection.

```md
# activity

## Purpose

Describe what belongs in this collection.

## Canonical Artifacts

Describe the file or artifact types agents should create or update here.

## Read Before Writing

Describe what agents should inspect before adding new data to this collection.

## Write Conventions

Describe naming, formatting, and placement conventions for this collection.

## Scripts and Automation

List any optional scripts tied to this collection and when to use them.

## Avoid

Describe what agents should avoid doing in this collection.
```

### Recommended `activity.md` Draft

```md
# activity

## Purpose

Store developer coordination artifacts for current and upcoming work.

## Canonical Artifacts

- plan files

## Read Before Writing

- read existing plan files that look relevant to the task
- avoid duplicating parallel plans for the same work

## Write Conventions

- use markdown files for plans
- keep one plan per workstream
- name files descriptively according to the project's chosen convention

## Scripts and Automation

No collection-local scripts yet.

## Avoid

- do not introduce a global summary format in V1
- do not create extra coordination artifacts unless the project docs ask for them
```

### Recommended `company.md` Draft

```md
# company

## Purpose

Store broader company, product, strategy, and decision context that should inform agent behavior.

## Canonical Artifacts

- strategy notes
- decision notes
- product context documents

## Read Before Writing

- read the most relevant recent context before adding a new note
- prefer extending an existing canonical note when appropriate

## Write Conventions

- use markdown
- keep titles specific
- prefer durable context over temporary brainstorming scraps

## Scripts and Automation

No collection-local scripts yet.

## Avoid

- do not dump unrelated raw notes here without context
- do not treat this as a universal inbox for every document
```

## Required Sections For `GSYNC.md`

Make sure `GSYNC.md` includes:

1. Purpose
2. Collections
3. Agent Workflow
4. Collection Conventions
5. Guardrails
6. Not Yet Implemented

## Required Sections For Collection Docs

Make sure each collection doc includes:

1. Purpose
2. Canonical Artifacts
3. Read Before Writing
4. Write Conventions
5. Scripts and Automation
6. Avoid

## Installing The Steady-State Skill

At the end of onboarding:

- install or surface the reusable `GSYNC` skill if the environment supports skill installation
- otherwise provide the user with the steady-state `GSYNC` skill artifact they should install or load next

After onboarding, future agents should use `GSYNC`, not `gsync-onboarding`.

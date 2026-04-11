# gsync

## Overview

`gsync` is a coordination layer for small engineering teams coding with AI. It gives teammates and planning agents shared context about what the team is trying to accomplish over the next two weeks, what should happen over the next few days, and what each person is actively working on right now.

The goal is not just to avoid Git conflicts. It is to avoid directional drift.

When multiple people are coding with strong agents, small differences in assumptions quickly become large differences in implementation, architecture, and product direction. By the time those differences show up in a PR, the expensive damage has already happened. `gsync` tries to make the team's intent visible before coding starts, so both humans and agents can make better decisions.

Today the project includes:

- a CLI for setting shared goals and tracking active plans
- a shared plan model with summary metadata plus canonical markdown bodies
- a unified company memory timeline with a compiled reviewer context pack
- a local sync step that generates agent-readable summary context files
- a dashboard for team visibility and team onboarding

The published CLI is intended to work without local source code or a manual `gsync init` step. By default it bootstraps itself against the hosted `nomergeconflicts` Firebase project. If you are self-hosting or testing a different environment, override those defaults with `GSYNC_API_BASE_URL`, `GSYNC_FIREBASE_PROJECT_ID`, and `GSYNC_FIREBASE_API_KEY`, or run `gsync init`.

## Inspiration

AI agents can now write quality code quickly. Using skills like [gstack](), us developers can build high quality plans that turn into real working and tested features. However, the issue of syncronization quickly becomes apparent as soon as multiple people on a team start agentic coding. The real cost doesn't come from syntax merge conflicts but rather mental model drift in the minds of the developers. 

Agents have become really good at making a change based on the current state of a repo. Still, they don't have enough context to answer the question of what to build or "should I build this?" They fully understand the present but have no understanding of the past or future goals. 

This project came from a real team failure mode: one person made local changes, another person branched from those changes, the first person later changed direction, and the second person kept building on stale assumptions. The painful part was not resolving the code conflict. The painful part was untangling two incompatible ideas after both had already spread through the codebase.

With AI coding, this gets worse:

- people can ship many PRs a day
- teammates cannot keep up by manually reviewing everything
- agents amplify small plan differences into large code differences

That means teams need something between a long-term roadmap and raw Git history: a lightweight shared planning layer that says what is happening, what has happened, and what should happen next.

## What Problem This Solves

`gsync` is built for teams where more than one person is actively coding with AI in the same repo.

It is designed to solve three problems:

1. Planning agents often produce good plans in the wrong direction because they lack context about team goals and active work.
2. Teammates do not have a fast, shared view of who is touching what, so they diverge before anyone notices.
3. Git and PRs show code history, but they do not capture the planning context that should guide the code.

## How It Solves It

`gsync` creates a shared coordination loop:

- the team sets a `2-week` goal for higher-level direction
- the team sets a `3-day` target for short-term focus
- each person publishes active plans with summaries, ownership, touched surfaces, and status
- teammates can pull and inspect each other's plans
- agents can ingest synced context before generating new plans

In practice, that means `gsync` becomes the place where intent lives, while Git remains the place where code lives.

The intended model is:

- Git answers: "what code changed?"
- `gsync` answers: "what are we trying to do, why, and who is doing what right now?"
- `gstack` is used to create the plans

## Current Direction

The current prototype uses Firebase and a local sync cache:

- Firebase stores shared team goals and plan records
- Firebase also stores company memory timeline state and compiled reviewer context state
- the CLI syncs summary context first, then compiles company memories and pulls full plans on demand
- the dashboard provides live visibility into goals, active plans, and recent updates

## Happy Path

```mermaid
flowchart TD
    A["Agent runs `gsync sync --last 20`"] --> B["`~/.gsync/CONTEXT.md` contains goals + active/recent plan summaries"]
    B --> C{"Relevant plan summary exists?"}
    C -- "Yes" --> D["Agent runs `gsync plan pull <id>`"]
    D --> E["Full markdown plan cached in `~/.gsync/plans/`"]
    C -- "No" --> F["Agent writes a new local markdown plan"]
    E --> G["Agent writes or edits local markdown plan"]
    F --> H["Agent runs `gsync plan push my-plan.md`"]
    G --> H
    H --> I["Firestore summary doc + canonical body doc updated"]
    I --> J["Agent codes and sends milestone notes with `gsync plan update <id> --note ...`"]
    J --> K["PR opened with `gsync plan review <id> --pr <url>`"]
    K --> L["After merge: `gsync plan merged <id>`"]
```

## Data Flow

```mermaid
flowchart LR
    subgraph Local
      A["Agent / CLI"]
      B["`~/.gsync/CONTEXT.md`"]
      C["`~/.gsync/index.json`"]
      D["`~/.gsync/plans/<slug>--<id>.md`"]
    end

    subgraph Firestore
      E["`teams/{teamId}/meta/{2week,3day}`"]
      F["`teams/{teamId}/plans/{planId}` summary doc"]
      G["`teams/{teamId}/plans/{planId}/content/current` body doc"]
    end

    A -->|"sync"| E
    A -->|"sync"| F
    A --> B
    A --> C
    A -->|"pull"| F
    A -->|"pull"| G
    A --> D
    A -->|"push"| F
    A -->|"push"| G
```

## Agent Commands

The intended happy-path command sequence for an agent is:

```bash
gsync signup --team claw-social --seat-name nathan-laptop
gsync join --code XXXX-XXXX-XXXX --seat-name teammate-mbp
gsync join-code create         # admin-only: mint a fresh teammate invite
gsync login --key <seat-key>
gsync sync --last 20
cat ~/.gsync/CONTEXT.md
gsync memory reviewer-context   # compiled memory bundle; fails closed if sync is stale
gsync plan pull <id>              # only if a summary looks relevant
gsync plan push my-plan.md        # create or update canonical plan
gsync plan update <id> --note "milestone or blocker"
gsync plan review <id> --pr https://github.com/org/repo/pull/123
gsync plan merged <id>
```

If you use GitHub, include `Plan: <id>` in the PR body as well. That gives merge automation a fallback if the `prUrl` link was not written onto the plan record.

Humans can also join from the dashboard login page with the same join code and a seat name. Use `gsync login --key <seat-key>` for returning seats, and `gsync join --code <join-code> --seat-name <name>` for new seats.

## Approval-Gated Memory

Durable company memory now flows through a direct append-only timeline before reviewer agents consume it:

```bash
gsync memory add --title "Company brief" --body "We help small teams stay aligned"
gsync memory add --title "Project brief" --body "This quarter focuses on onboarding and reliability"
gsync memory add --title "Decision" --body "Keep the memory timeline append-only"
gsync sync
gsync memory reviewer-context
```

Key behavior:

- `memory add` appends a new item to the company memory timeline.
- Memories are append-only markdown entries; older entries stay visible in the dashboard and compiled reviewer context.
- `gsync sync` recompiles the compiled memory bundle.
- If memory changes after your last sync, `gsync memory reviewer-context` fails closed until you sync again.

# Multi-Team Onboarding Plan

Status: Draft
Repo: `nwang783/nomergeconflicts`
Branch: `main`

## Goal

Make `gsync` usable by teams beyond the current single-user setup while keeping the product and CLI extremely simple.

The simplest version should:

- support team creation and team join
- support browser access for humans and CLI access for agents
- avoid exposing raw Firebase setup to end users
- keep onboarding to a minimal set of API calls
- preserve the existing plan-sync and dashboard flows

## Product Principles

- Keep one auth model.
- Keep one web app.
- Keep one shared backend shape.
- Prefer boring Firebase primitives over custom infrastructure.
- Optimize for “hard to mess up” over “most theoretically flexible.”

## Decisions Locked

- Use a single React app with:
  - `/` for a public homepage
  - `/app` for the authenticated dashboard
- Use Firebase Functions for onboarding/auth endpoints.
- Use Firestore as the main datastore.
- Use Firebase custom-token auth for browser and CLI sessions.
- Use seat-based access in v1.
- Use one-time or limited-use join codes.
- Issue durable agent keys server-side after signup/join.
- Store only hashed durable keys server-side.
- Remove raw Firebase bootstrap from user-facing CLI onboarding.

## Seat-Based Access Model

In v1, the authenticated actor is a seat. A seat can represent:

- a CLI coding agent
- a human using the browser
- an automation bot

This keeps one auth model for everyone.

```text
team
  |
  +-- memberships
        |
        +-- seat: "nathan-laptop"        role: admin
        +-- seat: "feature-agent"        role: member
        +-- seat: "pm-viewer"            role: viewer
```

## User Experience

### Public Homepage

The homepage should be minimal and do three things well:

- explain what `gsync` is
- show how to install/use the skill
- let an existing seat log in

Contents:

- hero section
- minimal “about us”
- install snippet pointing to:
  - [SKILL.md on GitHub](https://github.com/nwang783/gsync/blob/main/SKILL.md)
- agent key login form

### Dashboard Access

Humans should still be able to use the dashboard.

They do this by logging in with a seat key in the browser. That seat may be:

- created during initial team signup
- created by redeeming a join code
- designated as `viewer`, `member`, or `admin`

No separate “human account system” is needed in v1.

## High-Level Architecture

```text
Browser / CLI
   |
   +-- POST /teams
   +-- POST /teams/join
   +-- POST /agent/login
   v
Firebase Functions
   |
   +-- verify join codes / durable keys
   +-- create team + seat records
   +-- mint Firebase custom tokens
   v
Firebase Auth
   |
   v
Firestore
   |
   +-- teams/{teamId}
   +-- teams/{teamId}/memberships/{seatId}
   +-- teams/{teamId}/joinCodes/{joinCodeId}
   +-- seats/{seatId}
   +-- existing meta/plans collections
```

## API Surface

Keep the API surface minimal.

### `POST /teams`

Purpose:

- create a new team
- create the first admin seat
- return the durable seat key once
- return a Firebase custom token for immediate signed-in use

Request shape:

```json
{
  "teamName": "Acme",
  "seatName": "nathan-laptop"
}
```

Response shape:

```json
{
  "teamId": "team_123",
  "seatId": "seat_123",
  "seatKey": "shown-once-secret",
  "firebaseToken": "custom-token"
}
```

### `POST /teams/join`

Purpose:

- redeem a join code
- create a seat membership
- issue a durable seat key once
- return a Firebase custom token

Request shape:

```json
{
  "joinCode": "JOIN-ABC-123",
  "seatName": "pm-viewer"
}
```

Response shape:

```json
{
  "teamId": "team_123",
  "seatId": "seat_456",
  "seatKey": "shown-once-secret",
  "firebaseToken": "custom-token"
}
```

### `POST /agent/login`

Purpose:

- exchange a durable seat key for a Firebase custom token

Request shape:

```json
{
  "seatKey": "durable-secret"
}
```

Response shape:

```json
{
  "teamId": "team_123",
  "seatId": "seat_456",
  "role": "viewer",
  "firebaseToken": "custom-token"
}
```

## CLI Changes

Replace prototype bootstrap with product-facing onboarding commands.

### New commands

- `gsync signup --team <name> --seat-name <name>`
- `gsync join --code <join-code> --seat-name <name>`
- `gsync login --key <seat-key>`
- `gsync logout`

### Existing commands to preserve

- `gsync sync`
- `gsync status`
- `gsync plan push`
- `gsync plan pull`
- `gsync plan update`
- `gsync plan review`
- `gsync plan merged`

### CLI onboarding flow

```text
new team:
  gsync signup --team acme --seat-name nathan-laptop
    -> stores session locally
    -> signs into Firebase
    -> normal sync/plan commands work

join team:
  gsync join --code JOIN-ABC-123 --seat-name pm-viewer
    -> stores session locally
    -> signs into Firebase

returning seat:
  gsync login --key <seat-key>
    -> exchanges for Firebase token
```

## Local State

Split local state into app config vs session state.

```text
~/.gsync/
  config.json
    - apiBaseUrl
    - firebaseProjectId
    - firebaseApiKey

  session.json
    - teamId
    - seatId
    - seatName
    - role
    - lastLoginAt

  CONTEXT.md
  index.json
  plans/
```

The durable seat key should not be mixed into general config state.

## Firestore Model

```text
teams/{teamId}
  - name
  - createdAt
  - createdBySeatId

teams/{teamId}/memberships/{seatId}
  - role
  - seatName
  - status
  - joinedAt

teams/{teamId}/joinCodes/{joinCodeId}
  - codeHash
  - role
  - maxUses
  - uses
  - expiresAt
  - createdBySeatId

seats/{seatId}
  - seatName
  - keyHash
  - homeTeamId
  - createdAt
  - lastLoginAt
```

Existing team plan/meta collections stay in place.

## Security Model

The durable seat key is only used against the onboarding backend. It is never used directly against Firestore.

```text
seat key
   -> POST /agent/login
   -> backend verifies hash
   -> backend mints Firebase custom token
   -> client signs in
   -> Firestore rules enforce team membership
```

### Security requirements

- store only hashed seat keys server-side
- join codes must expire or have bounded use counts
- `/teams` and `/teams/join` must be transactional
- Firestore rules must block cross-team reads/writes
- browser team access must come from authenticated membership, not arbitrary URL params

## Frontend Plan

Keep the current dashboard app and wrap it with auth/session state.

### `/`

- hero
- minimal about section
- install snippet for `SKILL.md`
- login form for durable seat key
- optional “create team” and “join team” entry points

### `/app`

- existing dashboard overview
- plan detail
- activity
- current team derived from authenticated session

Do not split this into two different apps.

## Implementation Order

1. Add onboarding/session domain model.
2. Add Firebase Functions for `/teams`, `/teams/join`, and `/agent/login`.
3. Add Firestore Security Rules for membership-based access.
4. Replace CLI `init`-style onboarding with `signup`, `join`, `login`, and `logout`.
5. Split local config and session storage.
6. Add auth wrapper and route split in the dashboard app.
7. Build the homepage.
8. Regression-test all existing plan sync/dashboard flows.

## Test Plan Summary

Must cover:

- team creation happy path
- join-code happy path
- join-code expired/reused/exhausted paths
- durable key login success/failure
- Firestore cross-team access denial
- homepage render and login UX
- dashboard regression after auth wrapping
- CLI regression for existing sync/plan commands

## Failure Modes To Design For

- team created but first seat creation fails
- join code reused accidentally
- invalid durable key mints a token due to verifier bug
- authenticated browser can switch teams by URL without membership
- auth wrapper breaks current dashboard subscriptions

## What Already Exists

- Firestore-backed plan/meta storage
- CLI plan push/pull/sync/status flows
- local `CONTEXT.md` generation
- dashboard overview/activity/detail surfaces
- basic tests for plan-file parsing and lazy plan detail loading

## Not In Scope

- separate human account system
- billing
- password reset / email login
- admin control panel
- team-switcher UX across many teams
- drift detection/conflict warnings
- replacing Firebase

## TODOs

### TODO: update `SKILL.md` for the new onboarding flow

Why:

- The skill currently teaches the old single-user prototype model.
- Outside teams and agents will misuse the tool if the skill docs still reference raw Firebase-style setup.

Done when:

- `SKILL.md` documents `signup`, `join`, `login`, and `logout`
- `SKILL.md` explains seat-based access clearly
- `SKILL.md` explains that humans can use the dashboard via a browser seat
- `SKILL.md` removes or rewrites outdated `init` guidance
- examples match the new onboarding and sync flow

## Open Questions

- Should admins be able to generate join codes from the CLI first, the dashboard first, or both in the first pass?
- Should the first version support multiple team memberships per seat, or keep one seat bound to one home team?
- Should viewer-role seats be read-only for goals and plans in v1, or should all members be writable initially?

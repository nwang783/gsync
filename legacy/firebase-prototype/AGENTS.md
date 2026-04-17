# Agent Local Dev Setup

Use the repo-local sandbox before making or testing gsync changes.

## Start the local stack

```bash
npm run dev:up
```

This starts:
- Firestore emulator on `127.0.0.1:8080`
- Auth emulator on `127.0.0.1:9099`
- Functions emulator on `127.0.0.1:5001`
- Dashboard dev server on `http://127.0.0.1:5173`

## Seed demo data

```bash
npm run dev:seed
```

This creates an isolated dev home in `./.dev/home`, seeds a local team, goals, memory drafts, approved memory, and a sample plan, then writes the seed details to `./.dev/seed.json`.

## Run gsync against the sandbox

Use the isolated CLI wrapper so you do not touch your real `~/.gsync` state:

```bash
npm run dev:cli -- status
npm run dev:cli -- sync
npm run dev:cli -- memory reviewer-context
```

The wrapper runs gsync with `HOME=./.dev/home`.
Do not use plain `gsync ...` for local verification in this repo unless you intentionally want to hit your real global `~/.gsync` config and hosted backend.

## Smoke test the local setup

```bash
npm run dev:smoke
```

This seeds the sandbox and verifies the reviewer context plus the dashboard server.

## Reset or stop

```bash
npm run dev:down
npm run dev:reset
```

Use `dev:down` to stop the running processes and `dev:reset` to wipe the local sandbox state.

## Browser QA

Open `http://127.0.0.1:5173` after seeding. The dashboard should show:
- `## company memory`
- approved strategy
- planning evidence
- a sample active plan

## Manual Verification

Whenever you make a change, include a concrete manual verification path in your update for your human to be able to test the changes himself.
For local onboarding work, prefer `npm run dev:creds` after `npm run dev:up` so you can test with a seeded db, the admin seat key, the peer seat key, and the join code from `./.dev/seed.json`. Get all the info the human will need to verify the changes and provide it to him in your response.

## Notes for agents

- Keep all sandbox work inside `./.dev/`.
- Do not use the repo’s real `~/.gsync` data when testing local changes.
- For repo-local emulator work, always use `npm run dev:cli -- ...` so commands run with `HOME=./.dev/home` and `useEmulators=true`.
- Plain `gsync ...` remains global and should be treated as hosted unless you explicitly override `HOME`.
- If the stack is already running, `npm run dev:status` will show the active pids and paths.

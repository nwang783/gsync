# AGENTS.md

## Purpose

This repo is the V1 `gsync` rewrite.

The product is a repo-native agent convention system, not a hosted coordination app. Prefer skills and local docs over infrastructure.

## Working Rules

- Treat [V1_REWRITE_SPEC.md](/Users/nathanwang/Projects/nomergeconflicts/V1_REWRITE_SPEC.md) as the source of truth for the rewrite.
- Preserve the old Firebase prototype under [legacy/firebase-prototype](/Users/nathanwang/Projects/nomergeconflicts/legacy/firebase-prototype).
- Do not reintroduce backend, dashboard, auth, or CLI-first assumptions unless explicitly requested.
- Keep the machine-readable contract small. `.gsync/config.json` is the only required schema.
- Put reusable agent behavior in skills. Put project-specific behavior in `.gsync/GSYNC.md` and collection docs.

## Current Shape

The repo root should center on:

- [skills/gsync/SKILL.md](/Users/nathanwang/Projects/nomergeconflicts/skills/gsync/SKILL.md)
- [skills/gsync-onboarding/SKILL.md](/Users/nathanwang/Projects/nomergeconflicts/skills/gsync-onboarding/SKILL.md)

## Manual Verification

For onboarding and scaffolding changes, the main manual spot-check is skill-driven:

1. read the onboarding skill as if you were a fresh agent
2. verify it can explain `gsync` briefly without extra repo-local tooling
3. verify it can draft:
   - `.gsync/config.json`
   - `.gsync/GSYNC.md`
   - collection folders
   - collection docs
4. verify it hands future operation to `GSYNC`

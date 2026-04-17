---
name: GSYNC
description: Use an existing `.gsync/` system by first understanding what gsync is for, then reading the local config and docs, and only then reading or writing collection data.
---

# GSYNC

## What gsync Is For

`gsync` is a project-local context system for agents.

It exists to solve two problems:

- developer sync: agents and humans drift when current intent is not legible enough
- broader context: important product, company, and planning context often lives outside the code unless it is stored somewhere durable

`gsync` gives agents a local, documented way to:

- see what kinds of context exist
- know where that context lives
- understand how the current project wants that context represented
- read and write context through project files instead of hidden chat state

Do not treat gsync as a hosted tool, a summary service, or a universal data model. Treat it as an operating contract for context inside the current project.

## When To Use This Skill

Use this skill when the current project already has `.gsync/` and you need to work within it.

If `.gsync/` does not exist yet, stop and use `gsync-onboarding` instead.

## What Defines gsync In A Project

This skill is generic. It does not define the current project's semantics by itself.

The current project's gsync system is defined by:

- `.gsync/config.json`
- `.gsync/GSYNC.md`
- each collection's configured doc file

Those files are the source of truth.

## What `config.json` Is

`.gsync/config.json` is the machine-readable map of the system.

It tells you:

- which collections exist
- where each collection lives
- where each collection's doc file lives

Read it first so you know what the current project has actually declared.

## What `GSYNC.md` Is

`GSYNC.md` is the high-level project guide for gsync.

It should tell you:

- why the current project uses gsync
- what collections exist
- what each collection is for at a high level
- any project-wide guardrails for agents

Use it to understand the overall system before you dive into collection-specific docs.

## What Collections Are For

Collections are the top-level buckets of context in `.gsync/`.

Each collection exists to group one kind of context and define how agents should work with it. A collection should tell you:

- what kind of data belongs there
- what artifact types are canonical there
- what to read before writing
- what to avoid doing there

Do not assume two projects use the same collections the same way.

## Required Read Order

Before you read or write collection data:

1. Read `.gsync/config.json`
2. Read `.gsync/GSYNC.md`
3. Identify which collections are relevant
4. Read the relevant collection doc file(s)
5. Only then inspect or modify collection artifacts

Do not skip this order.

## How To Orient Yourself

When you encounter `.gsync/`:

1. Read the config to learn which collections exist.
2. Read `GSYNC.md` to understand how the current project uses them.
3. Read only the collection docs relevant to the task.
4. Inspect existing artifacts before creating new ones.

You are trying to answer:

- what kinds of context exist here
- which collection matters for this task
- what artifact shape is canonical
- what the current project wants agents to avoid

## Rules

- Do not silently add or remove collections
- Do not invent collection structure the current project has not documented
- Do not assume `activity`, `company`, or any other collection exists unless config says it does
- If the task requires a new collection or a new convention, surface that and ask for approval

## Creating New Collections

If the current project needs a new collection:

- do not create it silently
- propose it to the user first
- once approved, add it by updating `.gsync/config.json`, `.gsync/GSYNC.md`, and the new collection doc together
- use `gsync-onboarding` if the change is effectively a setup or extension flow

## How To Decide What Matters

After reading config and docs:

- identify which collections are relevant to the task
- read only those collection docs and artifacts
- avoid scanning unrelated collections unless the project docs tell you to
- prefer the smallest amount of context needed to do the work correctly

## Required Workflow

1. Read `.gsync/config.json`
2. Read `.gsync/GSYNC.md`
3. Find the collection or collections relevant to the task
4. Read each relevant collection doc
5. Inspect the existing canonical artifacts in those collections
6. Make the minimum change that follows the documented conventions

## Behavior Inside Collections

When writing inside a collection:

- match the naming and formatting conventions described in the collection doc
- prefer editing existing canonical artifacts over creating parallel variants
- keep collection-local logic local
- reference collection-local scripts only if the collection doc tells you to use them
- keep the write proportional to the task instead of redesigning the collection

## What To Surface To The User

Flag these instead of deciding silently:

- a new collection seems necessary
- the collection doc is missing
- the collection doc conflicts with `.gsync/config.json`
- the current project docs do not explain how to represent the artifact you need
- there are multiple plausible conventions and the better one is a judgment call

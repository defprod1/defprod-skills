---
name: defprod-change-design
description: Design stage of the change workflow — explore the solution space for a change, settle the approach with the user, and record the design on the change record. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod__getChange
  - mcp__defprod__patchChange
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Design

Produce the design for a change — the *how* behind the intent's *what & why* —
and record it on the change record.

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey }`.
2. A branch named `chg/CHG-NN-*` → resolve via `getChange { productId, key }`.
3. A `Change: CHG-NN` trailer on the HEAD commit → same resolution.

If a context resolves: call `startChangeStage { changeId, stage: 'design' }`
before beginning, and `finishChangeStage { changeId, stage: 'design' }` when
the design is agreed. If the work is abandoned mid-stage, call
`cancelChangeStage`. **If no context resolves, proceed silently** — stamping
only applies when a change record is attached.

## Workflow

1. **Ground in the intent.** Read the change's `intent` (and the codebase
   areas it touches). The design serves the intent — challenge scope creep.
2. **Explore the decision space.** Identify the genuine decisions (data model,
   API shape, UI placement, migration). For each: options, recommendation,
   trade-offs. For substantial designs, walk the decisions with the user one
   at a time; for small ones, present the whole approach at once.
3. **Settle it with the user.** The design stage ends with an *agreed* design,
   not a proposed one.
4. **Record it** on the change record:
   - Short, self-contained designs → `patchChange` writing the `design` field
     (markdown; include alternatives-considered).
   - Living/large design docs → write the doc in the repo and `patchChange`
     the `designDocPath` pointer instead.

## Rules

- Design is **skippable** — if the orchestrator or user deems the change too
  small to design, this skill is simply never invoked; do not invent ceremony.
- The recorded design is the *frozen decision*; ongoing evolution belongs in a
  living doc referenced by `designDocPath`.

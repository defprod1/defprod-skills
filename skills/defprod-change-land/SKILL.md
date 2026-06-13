---
name: defprod-change-land
description: Land stage of the change workflow — commit with the Change trailer, then merge and/or push per the repo's flow, stamping the merge/push stages. The Change trailer is what lets CI hooks correlate later pipeline stages. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - mcp__defprod__getChange
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Land (merge / push)

Get the reviewed change onto the deployable branch, carrying the correlation
trailer that CI/CD hooks use to stamp the remaining pipeline stages.

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey }`.
2. A branch named `chg/CHG-NN-*` → resolve via `getChange { productId, key }`.
3. A `Change: CHG-NN` trailer on the HEAD commit → same resolution.

This stage handles **two pipeline stages** — `merge` and `push` — stamping
whichever of them are enabled in the product's pipeline. **If no context
resolves, proceed silently** (commit/push without stamping or trailer).

## Execution mode (autonomous / interactive)

The orchestrator passes a **mode** derived from this stage's `driver`:
`agent` → `autonomous`, `human` → `interactive`. Invoked standalone with no
mode given, default to **interactive**.

- **autonomous** — commit and land without pausing for routine choices,
  `startChangeStage` before each merge/push you perform and `finishChangeStage`
  after it succeeds. Surface genuine blockers.
- **interactive** — keep the human in the loop: ask when the landing flow is
  ambiguous, and present before finishing.

Mode does **not** override the consent rule below: pushing or merging always
requires the repo's *standing consent* (rule 3) regardless of mode — autonomous
without standing consent commits and stops.

## Workflow

1. **Commit** the change's work (if uncommitted), following the repo's commit
   conventions, and append the correlation trailer as the final line:

   ```
   Change: CHG-NN
   ```

   Every commit belonging to the change carries it — it survives squashes and
   cherry-picks and is how CI resolves the change from a push range.

2. **Land per the repo's flow** — ask the user if ambiguous. For every merge or
   push **you** perform, stamp the matching stage on **both sides** of the
   operation: `startChangeStage { stage }` immediately before you begin, then
   `finishChangeStage { stage }` once it succeeds. The start stamp records that
   the landing operation is underway (and who is driving it); the finish stamp
   records completion. If the operation fails, leave the stage started (or
   `cancelChangeStage` if you abandon it) — never finish a stage whose operation
   did not succeed.
   - **Branch/PR flow**: push the `chg/CHG-NN-*` branch and open/hand off the
     PR. The `merge` stage finishes when the PR merges — if you perform the
     merge, `startChangeStage { stage: 'merge' }` before it and
     `finishChangeStage { stage: 'merge' }` after; if the platform/CI performs
     it, its hook stamps both instead. `push` is typically redundant here
     (often disabled in the pipeline).
   - **Trunk flow**: commit on the default branch; `merge` is typically
     disabled. `startChangeStage { stage: 'push' }`, push to origin, then
     `finishChangeStage { stage: 'push' }` on success.

   Only stamp stages that are enabled — a disabled stage is rejected by the
   server; treat that as "not my pipeline's stage", not an error.

3. **Never push or merge without the user's standing consent** for this repo's
   flow — when in doubt, stop after the commit and report.

## Rules

- The trailer is non-negotiable when a change context exists — a landed change
  without it is invisible to every downstream CI hook.
- Stamp `startChangeStage` before a merge or push you perform and
  `finishChangeStage` after it succeeds — both sides, even for quick atomic
  operations. The start stamp marks the landing as in progress; finish marks it
  done. (This supersedes any earlier "finish-only for quick operations"
  shortcut.)

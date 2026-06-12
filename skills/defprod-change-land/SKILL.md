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

## Workflow

1. **Commit** the change's work (if uncommitted), following the repo's commit
   conventions, and append the correlation trailer as the final line:

   ```
   Change: CHG-NN
   ```

   Every commit belonging to the change carries it — it survives squashes and
   cherry-picks and is how CI resolves the change from a push range.

2. **Land per the repo's flow** — ask the user if ambiguous:
   - **Branch/PR flow**: push the `chg/CHG-NN-*` branch and open/hand off the
     PR. The `merge` stage finishes when the PR merges — stamp
     `finishChangeStage { stage: 'merge' }` if you perform the merge; if the
     platform/CI does, its hook stamps it instead. `push` is typically
     redundant here (often disabled in the pipeline).
   - **Trunk flow**: commit on the default branch; `merge` is typically
     disabled. Push to origin and stamp `finishChangeStage { stage: 'push' }`
     on success.

   Only stamp stages that are enabled — a disabled stage is rejected by the
   server; treat that as "not my pipeline's stage", not an error.

3. **Never push or merge without the user's standing consent** for this repo's
   flow — when in doubt, stop after the commit and report.

## Rules

- The trailer is non-negotiable when a change context exists — a landed change
  without it is invisible to every downstream CI hook.
- Stamp `start` before long-running landing operations you perform (e.g. a
  merge with conflict resolution); quick atomic ones may finish-only.

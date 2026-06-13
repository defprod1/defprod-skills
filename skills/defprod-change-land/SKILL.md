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

**A resolved carrier is a hint, not proof — validate it.** `getChange` the key
and confirm the change is live: if it is **shipped (frozen)** or **cancelled**,
the carrier is stale (a prior change left un-cleared). Disregard it — deleting a
stale `.defprod/change` file — and proceed as **no-context**. Only an *active*
change is a live context to stamp.

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

**Merge/push consent follows the driver** (D14/D26). A stage's `driver` *is* the
durable consent signal: an `agent`-driven merge/push (→ **autonomous**) is
standing consent — merge/push **without prompting**. A `human`-driven merge/push
(→ **interactive**) makes the human the consent point — confirm before you merge
or push. Re-asking on an `agent` stage contradicts the config; honour it. Only
when run with **no driver context** (standalone, consent genuinely unknown) do
you default to committing and stopping.

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

3. **Merge/push consent = the stage driver** (D14/D26). `agent` (autonomous) →
   merge/push **without prompting** (the driver config is the standing consent);
   `human` (interactive) → confirm first. With **no driver context** (standalone,
   consent unknown), stop after the commit and report. Never assume consent you
   were given by neither config nor a human.

4. **Clear the worktree pin on hand-off.** Once your landing actions have
   succeeded — the push to origin (trunk flow: the deployable branch; branch/PR
   flow: the change branch, with the PR handed off) or a merge you performed —
   and the change is handed to CI/CD or the platform, **delete
   `.defprod/change`** — the worktree's hands-on role is over. The remaining
   stages (`build`/`package`/`staging`/`ship`) are stamped by CI/CD via the
   commit **trailer** deploy range (D24), never via the pin, so nothing
   downstream needs it. This preserves the invariant *pin present ⇔ a change is
   hands-on in this worktree* and frees the worktree for the next change without
   waiting for `ship`. If you only committed and **stopped** for consent (no
   push/merge performed), that is **not** a hand-off — leave the pin.

## Rules

- The trailer is non-negotiable when a change context exists — a landed change
  without it is invisible to every downstream CI hook.
- Stamp `startChangeStage` before a merge or push you perform and
  `finishChangeStage` after it succeeds — both sides, even for quick atomic
  operations. The start stamp marks the landing as in progress; finish marks it
  done. (This supersedes any earlier "finish-only for quick operations"
  shortcut.)

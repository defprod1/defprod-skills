---
name: defprod-change-review
description: Review stage of the change workflow — review the change's diff for correctness, scope fidelity, and convention adherence before it lands. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - mcp__defprod__getChange
  - mcp__defprod__getUserStory
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Review

Review the change before it lands. If the repo has its own review skill or
command (e.g. `/code-review`), prefer it — this skill is the generic fallback
and the stamping wrapper.

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

If a context resolves: call `startChangeStage { changeId, stage: 'review' }`
before beginning, and `finishChangeStage { changeId, stage: 'review' }` when
the review passes (findings resolved or accepted). If abandoned mid-stage,
call `cancelChangeStage`. **If no context resolves, proceed silently.**

## Execution mode (autonomous / interactive)

The orchestrator passes a **mode** derived from this stage's `driver`:
`agent` → `autonomous`, `human` → `interactive`. Invoked standalone with no
mode given, default to **interactive**.

- **autonomous** — run the stage end to end without pausing: at each fork take
  the reasonable default and `finishChangeStage` once the done-condition is met.
  Surface genuine blockers, never routine choices.
- **interactive** — keep the human in the loop: ask clarifying questions at real
  decision points, and **always present the result for explicit approval before
  `finishChangeStage`**.

Where the workflow below says "raise … with the user" / "ask the user", that is
the **interactive** path — in **autonomous** mode fix clear-cut defects and
proceed, recording accepted judgement calls in the finish note.

## Workflow

1. **Scope the diff**: everything the change touched (uncommitted work and/or
   the branch diff against the default branch).
2. **Review against three lenses**:
   - **Correctness** — logic errors, unhandled edge cases, races, broken error
     paths, security-relevant mistakes.
   - **Scope fidelity** — does the diff implement the linked stories'
     acceptance criteria, the whole criteria, and nothing beyond them?
   - **Conventions** — style, architecture patterns, naming, and rules the
     repo defines (read its rules/contributing docs if present).
3. **Resolve findings**: fix clear-cut defects; raise judgement calls with the
   user. Re-run the compile check after any fix.
4. **Verdict**: finish the stage only when no unresolved findings remain.

## Rules

- A review that changes code re-runs the tests it might have invalidated.
- Findings the user explicitly accepts are recorded in the finish note rather
  than silently dropped.

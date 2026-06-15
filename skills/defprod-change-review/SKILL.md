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

Review the change before it lands. This skill is **self-sufficient and
agent-portable** — it relies only on `Read`/`Grep`/`Bash` and the DefProd MCP,
so it gives the same review on any host (Claude Code, Cursor, or otherwise),
not just hosts that ship a built-in review command.

If your host has a richer native review command (e.g. `/code-review`) and you
are reviewing on a surface it fits — a GitHub pull request, say — you may prefer
it there. But for the DefProd change-record flow (diff-based, no pull request
required) this skill is the primary path, not a fallback.

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
2. **Gather context** before judging the lines in isolation — this is what
   keeps findings grounded and cuts false positives:
   - **Repo rules** — read the rules/contributing docs the repo defines for the
     touched surfaces, so convention findings cite an actual written rule.
   - **Git history** — `git log`/`git blame` the modified regions. A line that
     looks wrong in isolation is often a deliberate prior fix; conversely the
     history can reveal a re-introduced regression.
3. **Review against three lenses**:
   - **Correctness** — logic errors, unhandled edge cases, races, broken error
     paths, security-relevant mistakes.
   - **Scope fidelity** — does the diff implement the linked stories'
     acceptance criteria, the whole criteria, and nothing beyond them?
   - **Conventions** — style, architecture patterns, naming, and rules the
     repo defines (from the context gathered in step 2).
4. **Score each finding for confidence (single pass)** — for every candidate
   finding, assign a 0–100 confidence that it is a *real, change-introduced*
   issue, then **discard anything below 80**. Score down (and drop) findings
   that are:
   - pre-existing — on lines the diff did not change;
   - things a compiler/typechecker/linter would catch (CI runs separately);
   - pedantic nitpicks a senior engineer wouldn't raise, or a convention not
     actually written in the repo's rules;
   - likely-intentional changes related to the broader change;
   - silenced deliberately in-code (e.g. a lint-ignore with a reason).
   For a convention finding, confirm the repo rule actually names the issue
   before keeping it. The goal is a short list of high-confidence findings, not
   exhaustive nitpicking.
5. **Resolve the surviving findings**: fix clear-cut defects; raise judgement
   calls with the user. Re-run the compile check after any fix.
6. **Verdict**: finish the stage only when no unresolved findings remain.

## Rules

- A review that changes code re-runs the tests it might have invalidated.
- Findings the user explicitly accepts are recorded in the finish note rather
  than silently dropped.

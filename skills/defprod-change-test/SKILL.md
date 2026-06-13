---
name: defprod-change-test
description: Test stage of the change workflow — verify the implementation against every acceptance criterion of the in-scope stories and ensure e2e coverage; for bugs, confirm the original reproduction is fixed and a regression test exists. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - mcp__defprod__getChange
  - mcp__defprod__getUserStory
  - mcp__defprod__listUserStories
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Test

Verify the change does what the definition says, and leave durable test
coverage behind.

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

If a context resolves: call `startChangeStage { changeId, stage: 'test' }`
before beginning, and `finishChangeStage { changeId, stage: 'test' }` when all
criteria verify and required tests are green. If abandoned mid-stage, call
`cancelChangeStage`. **If no context resolves, proceed silently.**

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

Where the workflow below says "confirm with the user" / "present … for
confirmation" / "ask the user", that is the **interactive** path — in
**autonomous** mode make the documented default choice and proceed.

## Workflow — by change type

### Features & enhancements

1. **Verify each acceptance criterion** of every in-scope story, individually:
   in the running app where there is a dev server (browser automation for UI;
   direct calls for APIs), via the test suite otherwise. Never mark a
   criterion "assumed passing".
2. **E2e coverage** per in-scope story (use `e2eDir` from
   `.defprod/defprod.json` if configured; follow existing test patterns):
   - Test exists and passes → done.
   - Test exists but misses the new criteria → update it; run until green.
   - No test → create one covering all acceptance criteria; run until green.

### Bugs

1. **Confirm the fix**: repeat the original reproduction from the define stage
   and confirm correct behaviour.
2. **Regression-check**: verify *all* acceptance criteria on the in-scope
   stories, not just the broken one — fixes can introduce regressions.
3. **Regression test**: the suite should have caught this bug. Update the
   existing test (or create one) that reproduces the original condition and
   asserts correct behaviour; run until green.

### Both types

Run the compile check once more after any test changes. If verification
exposes implementation defects, report them — the orchestrator (or user)
returns the change to the code stage rather than patching around them here.

## Rules

- Acceptance criteria are the contract; the stage finishes only when each one
  has been *observed* passing.
- A story with no testable surface is flagged to the user, never padded with
  hollow assertions.

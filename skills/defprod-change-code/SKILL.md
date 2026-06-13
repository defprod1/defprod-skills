---
name: defprod-change-code
description: Code stage of the change workflow — implement the change within the scope defined by its linked user stories (or the traced bug), following the repo's conventions. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod__getChange
  - mcp__defprod__getUserStory
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Code

Implement the change. Scope comes from the define stage: the linked user
stories' acceptance criteria (features/enhancements) or the traced root cause
(bugs).

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey }`.
2. A branch named `chg/CHG-NN-*` → resolve via `getChange { productId, key }`.
3. A `Change: CHG-NN` trailer on the HEAD commit → same resolution.

If a context resolves: call `startChangeStage { changeId, stage: 'code' }`
before beginning, and `finishChangeStage { changeId, stage: 'code' }` when the
implementation compiles and is code-complete. If abandoned mid-stage, call
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

## Workflow

1. **Load the contract**: read the change's linked stories (acceptance
   criteria) or the bug's root-cause notes. For non-trivial work (multiple
   modules, architectural decisions, 3+ stories), outline a plan and confirm
   with the user before coding.
2. **Read before writing** — understand the existing code paths you are about
   to modify.
3. **Implement**, following the repo's conventions:
   - Match existing coding style, architecture patterns, and naming.
   - Stay within story scope — flag discovered extra work to the user instead
     of silently expanding.
   - Keep changes minimal; for bug fixes, fix the root cause without
     refactoring around it.
4. **Compile check**: run the project's build/compile verification
   (`compileCheck` from `.defprod/defprod.json` if configured, else the
   standard build). Fix all errors — the stage is not finished until the
   project compiles clean.

## Rules

- Code-complete means *compiles and implements the contract* — testing is the
  next stage's job, but obvious self-review happens here.
- Don't introduce new frameworks, patterns, or dependencies without the user's
  agreement.

---
name: defprod-change-define
description: Define stage of the change workflow — align the change with the product definition. For features/enhancements - user story alignment (find, update, or create stories); for bugs - reproduce and trace to the acceptance criteria that define correct behaviour. Links in-scope stories to the change record. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - mcp__defprod__listAreas
  - mcp__defprod__getArea
  - mcp__defprod__listUserStories
  - mcp__defprod__getUserStory
  - mcp__defprod__createUserStory
  - mcp__defprod__patchUserStory
  - mcp__defprod__getChange
  - mcp__defprod__patchChange
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

# Change Stage: Define

Connect the change to the product definition **before any code is written**.
The output is a confirmed scope: the user story IDs (and acceptance criteria)
that this change implements, linked onto the change record.

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey }`.
2. A branch named `chg/CHG-NN-*` → resolve via `getChange { productId, key }`.
3. A `Change: CHG-NN` trailer on the HEAD commit → same resolution.

If a context resolves: call `startChangeStage { changeId, stage: 'define' }`
before beginning, and `finishChangeStage { changeId, stage: 'define' }` when
scope is confirmed. If abandoned mid-stage, call `cancelChangeStage`.
**If no context resolves, proceed silently.**

## Workflow — by change type

### Features & enhancements: user story alignment

1. **Retrieve context**: `listAreas`, then `listUserStories` for the area(s)
   the change relates to. Read the stories and their acceptance criteria.
2. **Find relevant stories** and present them to the user for confirmation.
3. **Assess coverage** — one of three outcomes:
   - **Fully covered** — stories already describe the change. Note the IDs.
   - **Partially covered** — `patchUserStory` to update titles, descriptions,
     or acceptance criteria. Confirm with the user.
   - **Not covered** — `createUserStory` with clear acceptance criteria.
     Confirm with the user.
4. **Record scope**: state the in-scope story IDs.

### Bugs: reproduce and trace

1. **Understand the bug**: expected vs actual, where it occurs, reproduction
   steps. Ask for clarification if too vague to attempt.
2. **Trace to the definition**: find the story whose acceptance criteria
   define the *correct* behaviour — that contract is what "fixed" means. If no
   story covers the behaviour, create or update one (with user confirmation).
3. **Reproduce it** (UI via browser, API via calls, data via queries, or code
   inspection for evident logic errors). Document what you observed.
4. **Decision gate**: if the bug cannot be reproduced — HALT. Report what you
   tried, what you observed, and possible explanations. Cancel the stage work
   (`cancelChangeStage`) and return control to the user. Never fix an
   unconfirmed bug.

### Both types — link the scope

`patchChange` the change's `userStoryIds` to the in-scope story IDs.

## Rules

- **No code before definition.** Every change traces to acceptance criteria —
  that contract drives the test stage later.
- Story changes are always **confirmed with the user** before they are written.
- Acceptance criteria state capability, not implementation — keep routes,
  config keys, and file paths out of them.

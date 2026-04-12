---
name: defprod-fix-bug
description: Traces a reported bug back to user stories, fixes it, and verifies the fix against acceptance criteria. Halts if the bug cannot be reproduced.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod__listProducts
  - mcp__defprod__getProduct
  - mcp__defprod__listAreas
  - mcp__defprod__getArea
  - mcp__defprod__listUserStories
  - mcp__defprod__getUserStory
  - mcp__defprod__createUserStory
  - mcp__defprod__patchUserStory
---

# Fix Bug

Traces a reported bug back to the relevant user stories and acceptance criteria, reproduces it, fixes it, and verifies the fix against the acceptance criteria. If the bug cannot be reproduced, halts and reports findings to the user.

## When to use

- When the user reports a bug — something that used to work, works incorrectly, or violates acceptance criteria.
- When invoked via `/defprod-fix-bug`.
- **Not** for new features or enhancements — use `/defprod-implement-feature` instead.

## Inputs

- **Bug description** — what's broken, expected vs actual behaviour, steps to reproduce (if known).

## Config

This skill consults `.defprod/defprod.json` for optional hints. If the file doesn't exist, the skill discovers everything automatically.

| Key | Type | Purpose |
|-----|------|---------|
| `products[].name` | `string` | Matches product name to locate config entry |
| `products[].frontendApp` | `string` | Path to the frontend app |
| `products[].backendApp` | `string` | Path to the backend app |
| `products[].e2eDir` | `string` | Path to e2e test directory |
| `products[].compileCheck` | `string` | Command to verify compilation |

---

## Workflow

### Phase 1 — Understand & Reproduce

#### 1a. Understand the bug

Parse the user's bug description. Identify:
- **What** is broken (expected vs actual behaviour)
- **Where** it occurs (which page, component, flow, or API)
- **Steps to reproduce** (if provided; otherwise infer from the description)

If the description is too vague to attempt reproduction, ask the user for clarification before proceeding.

#### 1b. User story alignment

Trace the bug to the product definition — acceptance criteria define "correct behaviour".

1. Call `listAreas` from the DefProd MCP server.
2. Identify which area(s) the bug relates to.
3. Call `listUserStories` for the relevant area(s).
4. Find the user story (or stories) whose acceptance criteria describe the behaviour that is broken.
5. **Record in-scope story IDs** — these drive verification in Phase 3.

If no existing story covers the buggy behaviour, note this — you will create or update stories after the fix (Phase 2, step 2d).

#### 1c. Reproduce the bug

Attempt to reproduce the bug using whatever approach is appropriate:

- **UI behaviour**: Drive the app in a browser (if a dev server is running) and follow the reproduction steps.
- **API/backend behaviour**: Call the relevant API endpoint or use the project's test tooling.
- **Data issues**: Query the database or inspect data state.
- **Code inspection**: If the bug is evident from reading the code (e.g. a logic error, off-by-one, missing null check), that counts as confirmation.

Document what you observed and whether it confirms the reported bug.

#### 1d. Decision gate

**If the bug cannot be reproduced**, halt and report to the user:
1. What you tried and the exact steps performed
2. What you actually observed at each step
3. Possible explanations (data-dependent, environment-specific, already fixed, timing-dependent)
4. What additional information might help reproduce it

Do not proceed to fixing. Return control to the user.

**If the bug is reproduced**, proceed to Phase 2.

---

### Phase 2 — Fix

#### 2a. Identify root cause

Read the relevant source files to understand the current implementation. Trace the bug to its root cause:
- Check error logs if available
- Follow the code path that the reproduction steps exercise
- Identify which file(s) need to change

#### 2b. Implement the fix

Fix the bug in the production code. Follow the project's existing coding conventions and patterns. Keep the fix minimal — address the root cause without refactoring unrelated code.

#### 2c. Verify compilation

If the project has a compilation/build step, run it and fix any errors. Use `compileCheck` from `.defprod/defprod.json` if available.

#### 2d. Update user stories if needed

If no existing story covers the buggy behaviour, or acceptance criteria need updating:
- Call `patchUserStory` to add or update acceptance criteria on existing stories
- Or call `createUserStory` to create a new story with criteria that would catch this class of bug
- Confirm changes with the user
- Update the in-scope story ID list

---

### Phase 3 — Verify

#### 3a. Confirm the fix

Repeat the reproduction approach from Phase 1 to confirm the bug is fixed:
- If you reproduced via UI, repeat the browser steps and confirm correct behaviour
- If you reproduced via API, re-call the endpoint and confirm the correct response
- If you reproduced via code inspection, re-read the fixed code and confirm the logic is correct

If the bug still manifests, return to Phase 2 and iterate.

#### 3b. Verify acceptance criteria

For each in-scope user story, check that every acceptance criterion is satisfied — not just the one related to the bug. Bug fixes can introduce regressions.

#### 3c. E2e test coverage

For each in-scope user story, check if an e2e test exists:

- **Test exists and passes** — no action.
- **Test exists but should have caught this bug** — update it to cover the regression scenario, run until green.
- **No test exists** — create one that reproduces the original bug condition and asserts correct behaviour, run until green.

Use `e2eDir` from `.defprod/defprod.json` if available.

#### 3d. Final compilation check

If any code was changed in this phase, run compilation one more time.

---

### Summary

Present a summary:
- **Bug**: What was reported
- **Root cause**: What caused it
- **Fix**: What was changed (files and description)
- **User stories**: Which stories are in scope, any stories created or updated
- **Verification**: Confirmation the fix works
- **E2e coverage**: Which test(s) now cover this scenario

---

## Rules

- **Always reproduce before fixing** — never fix a bug you can't confirm exists. Code inspection counts as confirmation, but "it sounds like it could be broken" does not.
- **Halt if not reproducible** — do not guess at fixes. Report findings and let the user decide.
- **Trace to user stories** — acceptance criteria define correct behaviour. A bug fix without story alignment is a fix without a contract.
- **Keep fixes minimal** — fix the root cause. Don't refactor, clean up, or improve surrounding code.
- **Regression-check via acceptance criteria** — verify all criteria on in-scope stories, not just the broken one.
- **E2e tests must cover the regression** — if a bug slipped through, the test suite should catch it next time.

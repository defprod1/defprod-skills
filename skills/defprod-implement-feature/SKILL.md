---
name: defprod-implement-feature
description: End-to-end workflow for implementing a feature — user story alignment, implementation, and verification. Use when starting any coding task.
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

# Implement Feature

End-to-end workflow for implementing a feature or enhancement: align with user stories before writing code, implement, then verify against acceptance criteria. Ensures every code change traces back to a product definition.

## When to use

- When the user asks to implement, add, build, or change a feature.
- When starting any non-trivial coding task.
- When invoked via `/defprod-implement-feature`.

## Inputs

- **Task description** — what the user wants to implement.

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

### Phase 1 — User Story Alignment

**Do not write any code until this phase is complete.**

#### 1a. Retrieve context

1. Call `listAreas` from the DefProd MCP server to get the product's areas.
2. Call `listUserStories` for the area(s) most likely related to the task.
3. Read the user stories and their acceptance criteria.

Use `.defprod/defprod.json` to identify the product if multiple products exist.

#### 1b. Find relevant stories

Identify which existing user stories relate to the requested task. Present them to the user:

> **Related user stories:**
> - `AUTH-LOGIN` — User can log in with email and password
> - `AUTH-MFA` — User can enable two-factor authentication
>
> Does this task map to these stories, or is it something new?

#### 1c. Assess coverage

One of three outcomes:

1. **Fully covered** — existing stories and acceptance criteria already describe the task. Note the story IDs and proceed to Phase 2.

2. **Partially covered** — stories relate to the task but need updating. Call `patchUserStory` to update titles, descriptions, or acceptance criteria so they accurately reflect the task. Confirm changes with the user.

3. **Not covered** — no existing story represents the task. Call `createUserStory` to create new stories with acceptance criteria. Confirm with the user.

#### 1d. Record scope

Note the list of user story IDs that are in scope. These drive Phase 3.

> **In-scope stories:** `AUTH-LOGIN`, `AUTH-MFA`
>
> Proceeding to implementation.

---

### Phase 2 — Implementation

Write the code to implement the task.

#### Guidelines

- **Read before writing** — understand existing code before modifying it.
- **Follow project conventions** — match the coding style, architecture patterns, and naming conventions already in use.
- **Stay within scope** — implement what the user stories describe. Don't add unrequested features or refactor unrelated code.
- **Keep changes minimal** — the smallest change that correctly implements the feature is the best change.

For non-trivial tasks (multiple modules, architectural decisions, 3+ stories in scope), consider creating a plan and confirming with the user before coding.

---

### Phase 3 — Verification

Verify the implementation against the acceptance criteria.

#### 3a. Compile check

If the project has a compilation/build step, run it and confirm it passes. Use the `compileCheck` command from `.defprod/defprod.json` if available, otherwise use the project's standard build command.

Fix any compilation errors before proceeding.

#### 3b. Verify acceptance criteria

For each in-scope user story, check every acceptance criterion:

- Does the implementation satisfy this criterion?
- Can you verify it by reading the code, running the app, or running tests?

If the project has a running dev server, use browser automation to verify UI changes. If it has a test suite, run relevant tests.

#### 3c. E2e test coverage

For each in-scope user story, check if an e2e test exists:

- **Test exists and passes** — no action needed.
- **Test exists but needs updating** — update it to cover new/changed acceptance criteria, then run until green.
- **No test exists** — create one covering all acceptance criteria, then run until green.

Use `e2eDir` from `.defprod/defprod.json` if available to locate the test directory. Follow the project's existing test patterns.

#### 3d. Final check

Run compilation one more time after any test changes. Confirm everything is green.

---

### Summary

Present a summary of what was implemented:

- User stories addressed (IDs and titles)
- Files changed
- Tests added or updated
- Any items that need follow-up

---

## Rules

- **Never skip Phase 1** — every code change must trace back to a user story. This is the core value proposition of DefProd-aligned development.
- **Never write code before user story alignment is confirmed** — the user must agree on scope before implementation begins.
- **Stay within story scope** — if you discover additional work needed beyond the in-scope stories, flag it to the user rather than expanding scope silently.
- **Acceptance criteria are the contract** — Phase 3 verification checks each criterion individually. Don't skip criteria or mark them as "assumed passing".
- **Respect the codebase** — follow existing patterns. Don't introduce new frameworks, patterns, or tools without the user's agreement.

---
name: defprod-analyze-discrepancies
description: Finds drift between a product area's definition and the codebase implementation. Produces a structured discrepancy report.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(ls:*)
  - Bash(cat:*)
  - AskUserQuestion
  - mcp__defprod__listProducts
  - mcp__defprod__getProduct
  - mcp__defprod__listAreas
  - mcp__defprod__getArea
  - mcp__defprod__listUserStories
  - mcp__defprod__getUserStory
  - mcp__defprod__getBriefForProduct
---

# Analyse Discrepancies

Compares a product area's user stories and acceptance criteria against the actual codebase implementation. Identifies drift in both directions: features defined but not implemented, and features implemented but not defined. Produces a structured report that drives `/defprod-fix-discrepancies`.

## When to use

- When you suspect the product definition and codebase have drifted apart.
- After a period of development without definition updates.
- As a periodic health check on definition accuracy.
- When invoked via `/defprod-analyze-discrepancies <product-name> <area-key>`.

## Inputs

- **Product name** — the DefProd product.
- **Area key** — the area to analyse (e.g. `AUTH`, `BILLING`).

## Config

This skill consults `.defprod/defprod.json` for optional hints. If the file doesn't exist, the skill discovers everything automatically.

| Key | Type | Purpose |
|-----|------|---------|
| `products[].name` | `string` | Matches product name to locate config entry |
| `products[].frontendApp` | `string` | Path to the frontend app — focuses exploration |
| `products[].backendApp` | `string` | Path to the backend app — focuses exploration |

---

## Workflow

### Step 1 — Fetch the product definition

1. Call `listProducts` from the DefProd MCP server. Find the product by name.
2. Call `listAreas` for the product. Find the area by key.
3. Call `listUserStories` for the area. Read each story's title, description, and acceptance criteria.

If the area has no user stories, tell the user there's nothing to analyse and suggest running `/defprod-create-area-stories` first.

---

### Step 2 — Explore the codebase

Build a thorough inventory of what the codebase actually implements for this area.

#### 2a. Identify relevant code

Use `.defprod/defprod.json` paths if available. Otherwise, locate the code by:
- Searching for route definitions, module names, or directory names matching the area
- Following imports and dependencies from entry points
- Checking both frontend and backend code

#### 2b. Explore in parallel

Explore three dimensions simultaneously:

**Backend module** (if applicable):
- API routes and endpoints
- Controllers and handlers
- Services and business logic
- Data models and schemas
- Validation rules
- Access control and permissions

**Frontend module** (if applicable):
- Pages and components
- Forms and user interactions
- State management
- Navigation and routing
- Error handling and feedback

**Shared types/contracts** (if applicable):
- DTOs and interfaces
- API contracts
- Shared validation rules

For each capability found, document:
- What it does
- Which files implement it
- Key implementation details (e.g. validation rules, permission checks)

---

### Step 3 — Produce analysis

Compare the product definition against the codebase inventory. Produce **four tables**:

#### Table 1 — Stories or acceptance criteria with no implementation

Features defined in DefProd but not found in the codebase.

| Story | AC | Defined Behaviour | Recommendation |
|-------|----|--------------------|----------------|
| AREA-KEY | AC text | What the story says | Remove from definition / Implement |

#### Table 2 — Acceptance criteria with incomplete implementation

Features partially implemented — the code exists but doesn't fully satisfy the acceptance criteria.

| Story | AC | Defined Behaviour | Actual Behaviour | Recommendation |
|-------|----|--------------------|-------------------|----------------|
| AREA-KEY | AC text | What the story says | What the code does | Update definition / Fix code |

#### Table 3 — Implemented features with no story

Capabilities found in the codebase that have no corresponding user story.

| Feature | Files | Description | Recommendation |
|---------|-------|-------------|----------------|
| Feature name | file paths | What it does | Create story / Remove code |

#### Table 4 — Stories that diverge from implementation

Features where both the story and code exist, but the details don't match.

| Story | AC | Defined Behaviour | Actual Behaviour | Recommendation |
|-------|----|--------------------|-------------------|----------------|
| AREA-KEY | AC text | What the story says | What the code does | Update definition / Fix code |

#### Summary

After the tables, write a brief summary highlighting:
- The overall health of the definition (how much drift exists)
- Key themes (e.g. "Most drift is in validation rules" or "3 new features were added without stories")
- Recommended priority order for fixes

---

### Step 4 — Save report

Write the report to the project. Use a path like:
- `docs/defprod-discrepancy-<area-key>-<YYYY-MM-DD>.md`
- Or within the area's documentation directory if one exists

Tell the user where the report was saved.

> **Discrepancy analysis complete for {Area Name}.**
>
> - {N} stories/ACs with no implementation
> - {N} partially implemented ACs
> - {N} implemented features with no story
> - {N} stories diverging from implementation
>
> Report saved to `<path>`
>
> **Next step:** Run `/defprod-fix-discrepancies <report-path>` to apply the recommended fixes.

---

## Rules

- **Read the code, don't guess** — every classification must be based on actually reading the relevant source files. Don't infer implementation from file names alone.
- **Check both directions** — drift happens in both directions. Code without stories is as important as stories without code.
- **Be specific in recommendations** — "Update the story" is not enough. Specify what should change and why.
- **Don't fix anything** — this skill analyses and reports. Fixes happen in `/defprod-fix-discrepancies`.
- **Acceptance criteria are granular** — analyse each criterion individually, not just the story as a whole. One story might have 5 satisfied criteria and 1 that's drifted.
- **Always save the report** — even if no discrepancies are found, save a report confirming alignment.

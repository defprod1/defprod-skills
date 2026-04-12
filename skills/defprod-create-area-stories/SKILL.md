---
name: defprod-create-area-stories
description: Creates comprehensive user stories with acceptance criteria for a single product area by analysing the codebase. Use when an area exists but has no stories.
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
  - mcp__defprod__createUserStory
  - mcp__defprod__patchUserStory
  - mcp__defprod__getBriefForProduct
---

# Create Area Stories

Creates comprehensive user stories with acceptance criteria for a single product area by deep-diving the relevant source code, routes, tests, and documentation. Each story describes an existing, implemented capability.

## When to use

- When a product area has been created but has no user stories.
- When you want to populate stories for a specific area without running the full `/defprod-onboard-product` workflow.
- When invoked via `/defprod-create-area-stories <product-name> <area-key>`.

## Inputs

- **Product name** — the DefProd product.
- **Area key** — the area to populate (e.g. `AUTH`, `BILLING`).

## Config

This skill consults `.defprod/defprod.json` for optional hints. If the file doesn't exist, the skill discovers everything automatically.

| Key | Type | Purpose |
|-----|------|---------|
| `products[].name` | `string` | Matches product name to locate config entry |
| `products[].frontendApp` | `string` | Path to the frontend app — focuses research |
| `products[].backendApp` | `string` | Path to the backend app — focuses research |

---

## Workflow

### Phase 1 — Resolve

#### 1a. Find the product and area

1. Call `listProducts` from the DefProd MCP server. Find the product by name.
2. Call `listAreas` for the product. Find the area by key.
3. Call `getBriefForProduct` — read the brief for context on the product's purpose and users.

If the product or area doesn't exist, tell the user and suggest creating it first.

#### 1b. Check for existing stories

Call `listUserStories` for the area. If stories already exist:

> **This area already has {count} user stories.** Would you like to:
> - **Add more** — I'll research and create stories for capabilities not yet covered
> - **Replace all** — I'll delete existing stories and create a fresh set
> - **Cancel** — keep the existing stories as-is

If adding more, note the existing story keys and titles to avoid duplicates.

---

### Phase 2 — Research

Deep-dive the source code for this area to understand every capability.

#### 2a. Map area to source modules

Identify which source files, directories, and modules correspond to this area. Use:
- `.defprod/defprod.json` paths (if available)
- The area description and name to locate relevant code
- Route definitions, navigation structure, and module boundaries

#### 2b. Research each module

For each relevant module, read:

- **Routes and pages** — what views/endpoints exist
- **Controllers/handlers** — what operations are available
- **Services** — business logic and data operations
- **Data models/schemas** — what entities are managed
- **Test files** — these reveal expected behaviour and edge cases
- **UI components and forms** — what users interact with
- **Permissions** — access control rules and role checks
- **Validation rules** — input constraints and business rules

---

### Phase 3 — Create Stories

#### 3a. Draft stories

Write stories covering all implemented capabilities. Use these categories as a checklist — skip any that don't apply to this area:

1. **Listing/browsing** — viewing collections of items
2. **Detail views** — viewing individual items
3. **Creation** — creating new items
4. **Editing** — modifying existing items
5. **Deletion** — removing items
6. **State transitions** — status changes, approvals, workflows
7. **Relationships** — linking items to other items
8. **Import/export** — bulk operations, data movement
9. **Notifications** — alerts, emails, in-app messages
10. **Permissions** — access control, roles
11. **Integrations** — third-party connections
12. **Validation** — input rules, constraints
13. **Configuration** — settings, preferences

#### 3b. Create stories via MCP

For each story, call `createUserStory` with:

- `title` — what the user can do (e.g. "Invite team members by email")
- `key` — short identifier within the area (e.g. `TEAM-INVITE`). Use the area key as prefix
- `areaId` — the area ID
- `description` — "As a [persona], I want to [action] so that [benefit]"
- `status` — `completed` (these describe existing, implemented capabilities)
- `priority` — `high`, `medium`, or `low` based on the feature's centrality to the area
- `acceptanceCriteria` — 3-8 specific, testable criteria per story

**Acceptance criteria guidelines:**
- Each criterion must be independently verifiable
- Use concrete values where possible ("displays a maximum of 50 items per page", not "displays a reasonable number of items")
- Cover the happy path and key edge cases
- Include validation behaviour where relevant ("shows an error when email format is invalid")

Batch creation: create up to 10 stories per batch to keep interactions manageable.

#### 3c. Present summary

After creating all stories, present:

| Area | Stories Created | Categories Covered |
|------|----------------|--------------------|
| {area} | {count} | {list} |

Show the story titles as a checklist. Ask the user:

> **Review the stories above.** Would you like to:
> - **Adjust any stories** — I can update titles, descriptions, or acceptance criteria
> - **Continue** — the stories look good, move on

---

## Rules

- **All stories are `completed`** — this skill describes existing capabilities, not planned work. Every story should reflect something the codebase already implements.
- **Every field on every story must be populated** — no empty descriptions, no missing acceptance criteria.
- **Favour completeness over arbitrary targets** — if an area has 20 distinct capabilities, create 20 stories. Don't stop at 5 or 10.
- **Keys must be unique within the product** — use the area key as prefix (e.g. `AUTH-LOGIN`, `AUTH-REGISTER`).
- **Acceptance criteria must be testable** — specific enough that a developer could write an automated test from them. "Works correctly" is not a criterion.
- **Don't invent capabilities** — only create stories for features you can verify exist in the codebase. If unsure whether something is implemented, check the code.
- **Batch MCP calls** where possible to minimise round trips.

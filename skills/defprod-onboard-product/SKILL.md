---
name: defprod-onboard-product
description: Iteratively defines a single product in DefProd — brief, areas, user stories, validation, and architecture. Picks up where it left off on each invocation.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(ls:*)
  - Bash(cat:*)
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod__listProducts
  - mcp__defprod__getProduct
  - mcp__defprod__createProduct
  - mcp__defprod__patchProduct
  - mcp__defprod__getBriefForProduct
  - mcp__defprod__patchBrief
  - mcp__defprod__listAreas
  - mcp__defprod__getArea
  - mcp__defprod__createArea
  - mcp__defprod__patchArea
  - mcp__defprod__listUserStories
  - mcp__defprod__getUserStory
  - mcp__defprod__createUserStory
  - mcp__defprod__patchUserStory
  - mcp__defprod__getArchitectureForProduct
  - mcp__defprod__getArchitectureTree
  - mcp__defprod__createArchitectureElement
---

# Onboard Product

Brings a product from repository discovery to a complete DefProd definition — brief, areas, user stories, validation, and optional architecture. Designed for repeated invocation: it checks what already exists and picks up where it left off.

## When to use

- After `/defprod-onboard-repo` has written `docs/defprod-onboarding.md`.
- When invoked via `/defprod-onboard-product <product-name>`.
- When the user wants to create or continue building a DefProd product definition.

## Inputs

- **Product name** — the name of the product to onboard (must match an entry in `docs/defprod-onboarding.md` or be provided by the user).

## Config

This skill consults `.defprod/defprod.json` for optional hints. If the file doesn't exist, the skill discovers everything automatically.

| Key | Type | Purpose |
|-----|------|---------|
| `products[].name` | `string` | Matches product name to locate config entry |
| `products[].frontendApp` | `string` | Path to the frontend app — focuses codebase research |
| `products[].backendApp` | `string` | Path to the backend app — focuses codebase research |

---

## Workflow

### Status check — determine starting phase

Before doing anything, check what already exists:

1. Call `listProducts` from the DefProd MCP server. Look for a product matching the provided name.
2. If the product exists:
   - Call `getBriefForProduct` — check if the brief is populated (has description, problem, users, requirements).
   - Call `listAreas` — check if areas exist.
   - If areas exist, call `listUserStories` for each area — check if stories exist.
3. Read `docs/defprod-onboarding.md` if it exists — this provides package paths, descriptions, user notes, and optionally a **Repo ID** from repo onboarding. If a `Repo ID` is present and is not `none`, record it for use in Phase 1 (product creation) and Phase 6 (completion).

Based on what exists, skip to the earliest incomplete phase:

| State | Start at |
|-------|----------|
| No product in DefProd | Phase 1 |
| Product exists, brief empty | Phase 1 (brief step) |
| Brief populated, no areas | Phase 2 |
| Areas exist, some/all missing stories | Phase 3 |
| All stories exist | Phase 4 (validation) |
| Validation done | Phase 5 (architecture) |

Tell the user what you found and which phase you're starting from.

---

### Phase 1 — Product & Brief

Create the product and populate its brief.

#### 1a. Create product (if needed)

If the product doesn't exist in DefProd, call `createProduct` with:
- `name` — the product name from the onboarding document or user input
- `teamId` — the team ID (from the MCP server's authentication context)

If a **Repo ID** was recorded from the onboarding document (not `none`), also pass:
- `repoId` — the repo entity ID
- `repoPackagePath` — the primary package path for this product (from the onboarding document's product details)
- `onboardingStatus` — set to `onboarding` to signal the guide UI that product definition is in progress

The backend atomically links the created product to the repo's `products` array when `repoId` is provided — the skill does not need to call `patchRepo`.

If no Repo ID is available (skill running outside the guide flow), call `createProduct` with just `name` and `teamId`. The product's `onboardingStatus` defaults to `idle`.

#### 1b. Research the codebase

Read the onboarding document to find the package paths for this product. Then research those packages:

- Read documentation files (README, docs/, CONTRIBUTING, etc.)
- Read the project manifest (package.json, pyproject.toml, etc.)
- Explore the source structure — entry points, route definitions, key modules
- Identify the main user-facing capabilities
- Identify the technology stack

Use `.defprod/defprod.json` paths if available to focus research on the right directories.

#### 1c. Populate the brief

Call `patchBrief` from the DefProd MCP server to populate each section. To avoid large payloads, split into **three calls**:

**Call 1 — Core identity:**
- `description` — 2-3 sentences explaining what the product does and who it serves
- `problem.summary` — the core problem this product solves
- `problem.context` — background and market context
- `problem.impact` — what happens if the problem isn't solved

**Call 2 — Users and requirements:**
- `users` — 2-5 user personas, each with name, description, goals, and pain points
- `requirements` — 10-25 functional requirements covering the product's capabilities

**Call 3 — Success criteria and aesthetics:**
- `successCriteria` — 5-10 measurable success criteria
- `outOfScope` — explicit boundaries of what this product does NOT do
- `aesthetics.tone` — the product's communication tone
- `aesthetics.style` — visual and interaction style principles
- `aesthetics.principles` — 3-5 guiding design principles
- `references` — links to relevant documentation, design systems, or resources

#### 1d. Present for review

Show the user a summary of the brief you've populated. Ask them to review and suggest changes before proceeding.

---

### Phase 2 — Areas

Propose and create product areas.

#### 2a. Research area candidates

Explore the codebase to identify logical areas. Look for:

- Top-level route groups or navigation sections
- Major feature modules or domain boundaries
- Distinct user workflows (e.g. onboarding, billing, team management)
- Admin vs user-facing sections

#### 2b. Propose areas

Present a table of proposed areas:

| Area | Key | Description |
|------|-----|-------------|
| ... | ... | ... |

Ask the user to confirm, add, remove, or rename areas before creating them.

#### 2c. Create areas

For each confirmed area, call `createArea` from the DefProd MCP server with:
- `name` — human-readable name
- `key` — short uppercase key (e.g. `AUTH`, `BILLING`, `TEAM`)
- `productId` — the product ID
- `description` — 1-2 sentences explaining the area's scope

---

### Phase 3 — User Stories

Create user stories for each area. This phase can span multiple sessions — the skill creates stories for as many areas as the user wants per invocation.

#### 3a. Choose session scope

Present the areas and their story counts. Ask the user which areas to work on in this session:

> **Areas ready for stories:**
> - Auth (0 stories)
> - Billing (0 stories)
> - Team Management (3 stories)
>
> Which areas would you like to tackle now? You can do all of them or pick specific ones.

#### 3b. Research each area

For each area in scope, deep-dive the relevant source code:

- Route definitions and page components
- API endpoints, controllers, and services
- Data models and schemas
- Test files (they reveal expected behaviour)
- UI components and forms
- Permissions and access control

#### 3c. Create stories

For each area, create user stories covering all implemented capabilities. Use these categories as a checklist — skip any that don't apply:

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

For each story, call `createUserStory` with:
- `title` — what the user can do (e.g. "Invite team members by email")
- `key` — short identifier (e.g. `TEAM-INVITE`)
- `areaId` — the area ID
- `description` — "As a [persona], I want to [action] so that [benefit]"
- `status` — `completed` (these describe existing, implemented capabilities)
- `priority` — `high`, `medium`, or `low`
- `acceptanceCriteria` — 3-8 specific, testable criteria

#### 3d. Present summary

After creating stories for each area, show a count and ask if the user wants to review any stories or continue to the next area.

---

### Phase 4 — Validation

Check that the product definition accurately reflects the codebase.

#### 4a. Run discrepancy analysis

For each area, compare the user stories and acceptance criteria against the actual codebase implementation. Look for:

1. **Stories with no code** — defined but not implemented
2. **Incomplete implementations** — acceptance criteria not fully met
3. **Code with no story** — implemented features missing from the definition
4. **Diverged details** — story describes one thing, code does another

#### 4b. Present findings

Show a consolidated summary of discrepancies across all areas. Ask the user how to handle them:

> **Discrepancies found:**
> - 3 stories have acceptance criteria not fully covered by code
> - 5 implemented features have no corresponding user story
> - 2 stories describe behaviour that differs from the implementation
>
> How would you like to proceed?
> - **Fix all** — update the definition to match reality
> - **Cherry-pick** — review each discrepancy individually
> - **Skip** — accept the definition as-is and move on

#### 4c. Apply fixes

Based on the user's choice, update user stories (via `patchUserStory` or `createUserStory`) or note items for the user to address later.

---

### Phase 5 — Architecture (optional)

Ask the user if they want to add architecture elements.

> **The product definition is complete.** Would you like to add architecture elements? These capture the technical structure — services, databases, APIs, libraries — at a level useful for AI agents reasoning about the system.
>
> - **Yes** — I'll research the technical structure and propose elements
> - **Skip** — finish without architecture (you can add it later)

If yes:

#### 5a. Research technical structure

Explore the codebase for:
- Services and their responsibilities
- Databases and data stores
- External APIs and integrations
- Shared libraries and their roles
- Infrastructure components (queues, caches, etc.)

#### 5b. Create architecture elements

Call `createArchitectureElement` for each component, organising them into a tree that reflects the system's structure.

---

### Phase 6 — Completion & Summary

#### 6a. Signal onboarding complete

If the product was created with a `repoId` (i.e. a Repo ID was present in the onboarding document), call `patchProduct` to set `onboardingStatus` to `onboarded`:

```json
[{ "op": "replace", "path": "/onboardingStatus", "value": "onboarded" }]
```

This signals the guide UI that this product's definition is complete. If the product was created without a `repoId`, skip this step.

#### 6b. Present summary

Present the complete product definition:

- Product name and brief summary
- Number of areas
- Total user stories across all areas
- Architecture elements (if created)
- Any noted items the user should address

Suggest next steps:

> **Next steps:**
> - Run `/defprod-create-area-tests <area>` to generate e2e tests from your user stories
> - Run `/defprod-analyze-discrepancies <area>` periodically to catch drift
> - Use `/defprod-implement-feature` when building new features — it ensures user story alignment

---

## Rules

- **Always check status first** — never recreate what already exists. Read before writing.
- **Always get user confirmation** before creating areas or stories in bulk. Present proposals and wait for approval.
- **Stories describe existing capabilities** — since this skill analyses an existing codebase, all stories should have `status: completed`. They describe what the product already does, not what it should do.
- **Favour completeness over arbitrary targets** — don't stop at 5 stories per area if the codebase has 12 distinct capabilities. Cover everything that exists.
- **Don't reference internal tooling** — this skill should work with any codebase and test framework. Don't hardcode paths to specific tools or scripts.
- **Description quality matters** — acceptance criteria should be specific enough that a developer or test framework can verify them. "Works correctly" is not an acceptance criterion.
- **Batch MCP calls** where possible to minimise round trips.

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

1. Call `listProducts` from the DefProd MCP server.
2. **Match against existing products**:
   - **Exact match** (case-insensitive name match): proceed with this product — extract its ID and continue to step 3.
   - **No exact match — check for similar products**: scan the full product list for names that resemble the requested name (e.g. substring match, word overlap, abbreviation match, or obvious typo). If one or more similar products exist, present them to the user:

     > **No exact product match for "<requested-name>", but these existing products look similar:**
     >
     > | # | Name | ID |
     > |---|------|----|
     > | 1 | <similar-name-1> | <id> |
     > | 2 | <similar-name-2> | <id> |
     >
     > **(a)** Continue with one of the above (specify the number)
     > **(b)** Create a new product called "<requested-name>"

     Wait for the user's choice. If they pick an existing product, use that product's ID and continue to step 3. If they choose to create new, proceed to Phase 1.
   - **No match and no similar products**: proceed to Phase 1 (product creation).
3. If the product exists (from step 2):
   - Call `getBriefForProduct` — check if the brief is populated (has description, problem, users, requirements).
   - Call `listAreas` — check if areas exist.
   - If areas exist, call `listUserStories` for each area — check if stories exist.
3. Read `docs/defprod-onboarding.md` if it exists — this provides package paths, descriptions, user notes, and optionally a **Repo ID** from repo onboarding. If a `Repo ID` is present and is not `none`, record it for use in Phase 1 (product creation) and Phase 6 (completion).
4. **Link existing product to Repo if unlinked**: If the product already exists (step 1) AND a Repo ID is available from the onboarding document (step 3) AND the product's `repoId` is not set, call `patchProduct` to establish the link:
   ```json
   [
     { "op": "replace", "path": "/repoId", "value": "<repo-id>" },
     { "op": "replace", "path": "/repoPackagePath", "value": "<package-path>" }
   ]
   ```
   Use the primary package path for this product from the onboarding document's product details. This handles the case where products were created before the Repo entity existed.

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
- `references` — links to relevant documentation, design systems, or resources. **Always populate this**: include (a) the onboarding document at `docs/defprod-onboarding.md`, (b) the primary README for the package(s) that back this product, (c) any design docs, ADRs, or external references discovered in Phase 1b. Use `type: "other"` for internal docs and `type: "inspiration"` or `type: "competitor"` for external products. Leave `references` empty only if nothing was discovered.

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

`createArea` returns `{areaId, key, name, productId}`. You will reference areas by `key` when creating stories in Phase 3 — there is no need to pair returned `areaId` UUIDs with requested keys, and doing so from memory across batches is where area-mismatch bugs come from.

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
- Data models and schemas — enumerate every entity the area exposes
- Test files (they reveal expected behaviour)
- UI components and forms
- Permissions and access control

**Build a capability matrix before writing stories.** For each distinct entity (service, ticket, quote, subscriber, CPE device, …) in the area, tick which of these verbs the code actually supports and note the source of truth:

| Entity | List | Detail | Create | Edit | Delete | State transitions | Validations | Permissions / feature gates |
|---|---|---|---|---|---|---|---|---|

Use the matrix as a coverage checklist when writing stories. An area that exposes writes in the codebase (forms, POST/PATCH endpoints, state-transition methods) but ends up with only read stories signals that Phase 3c stopped early — go back and add stories for the missing verbs. If the codebase genuinely only exposes reads, say so explicitly in the area's description and move on.

#### 3c. Create stories

For each area, create user stories covering every implemented capability. Use these categories as a checklist — skip any that don't apply:

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
- `title` — what the user can do, phrased as an outcome not a locator (e.g. "Invite team members by email", not "Open /team/invite"). Every title must contain a user-facing verb (`see`, `open`, `create`, `edit`, `delete`, `submit`, `download`, `manage`, `raise`, `escalate`, …).
- `key` — area key prefix + 2-digit zero-padded number (e.g. `TEAM-01`, `TEAM-02`)
- `areaKey` — the area's `key` (e.g. `TEAM`, `AUTH`). **Always prefer `areaKey` over `areaId`.** Opaque UUIDs carried in memory across batches drift silently and file stories under the wrong area; the semantic `areaKey` cannot. The backend also cross-checks that the story `key` starts with `${areaKey}-` and rejects mismatches.
- `description` — `"As a <persona>, I want to <action> so that <benefit>."` The `<persona>` MUST be drawn from the canonical persona list — see **Persona reuse** below.
- `status` — `completed` (these describe existing, implemented capabilities)
- `priority` — `high`, `medium`, or `low`
- `acceptanceCriteria` — see **Acceptance criteria** below

**Before each batch**, call `listAreas` for the product to get the fresh `{_id, key, name}` mapping. Do not carry area identifiers in your head across batches — look them up every time.

**After each batch**, call `listUserStories` for the target area and confirm every newly-created story key appears in the result. If any are missing, stop immediately and investigate — the missing stories landed under the wrong area.

##### Persona reuse (mandatory)

Build a canonical persona list from `brief.users` — each persona's `title` (lowercased) is a valid value. Add one fallback: `"any signed-in user"` for cross-cutting stories (shell, settings, profile).

Every story's description MUST begin with one of those titles verbatim. Do NOT mint ad-hoc variants ("customer user with Radware DDoS", "customer user in the satellite wizard"). If the story only applies to a persona under a specific condition, put the condition in the acceptance criteria (`"The DDoS dashboard is only visible when the Radware integration is enabled."`) — keep the persona canonical.

##### Acceptance criteria (mandatory rules)

- **Count: as many as are needed to thoroughly verify the story.** There is no minimum beyond "enough to prove the story works" and no upper bound. Do not stop at 3 because the story is small; do not pad to 8 because the story is big. A simple read-only page may need 3; a multi-step wizard may need 12. Never add filler criteria to hit a target.
- **Observable to the user, not the implementer.** Each criterion must describe something the user can see, do, or experience — not how the code achieves it. Class names, method calls, route constants, `canActivate`/`canDeactivate`, RxJS primitives, service/DAO identifiers, and Angular guard class names do NOT belong in acceptance criteria. Route URLs are allowed only as navigation outcomes ("clicking the Services tab lands on `/portal/services`"), not as routing-module configuration ("Route `/portal/services` maps to `PortalServiceListComponent`").

  | ❌ Implementation-leaky | ✅ User-observable |
  |---|---|
  | `Route /portal/services maps to PortalServiceListComponent with canDeactivate: [ChangeGuard] and breadcrumb 'My Services'.` | `Clicking "Services" in the sidenav shows the list of services with the breadcrumb "My Services". If the user has unsaved edits, they are prompted to confirm before navigating away.` |
  | `onFilterToggle('Show Closed', value) sets this.showClosed to the boolean value.` | `Toggling "Show Closed" includes decommissioned and cancelled services in the list; toggling it off hides them.` |
  | `The 'Manage API Keys' item is only rendered when checkFeatureEnabled(['API', 'Change API Keys']) is true.` | `The "Manage API Keys" menu item is visible only to users whose role includes the "Change API Keys" permission.` |

- **Testable.** Each criterion must be specific enough that an e2e or unit test could assert it. "Works correctly" is not a criterion.
- **Concrete values over adjectives.** "Displays up to 50 items per page" beats "displays a reasonable number"; "shows an error when email is missing an @" beats "validates email".
- **One concern per criterion.** Compound criteria ("Filters, sorts, and paginates work") should split into separate lines.

##### "Open the list at /X" archetype

Route-opening stories are valid, but their acceptance criteria must focus on what the user sees and can do on that page, not on the route configuration. A typical good shape:

- Which personas / feature permissions make the entry point visible.
- What is shown on first load (columns, empty-state text, default sort/filter).
- What actions are available and what they navigate to from the user's perspective.
- What happens to unsaved edits on navigation away (when relevant).

A typical bad shape: `canDeactivate: [ChangeGuard]`, `host-class 'routedFlex'`, `routes [… ComponentName …]`. Move those details into the architecture elements (Phase 5) — they belong to implementation, not product.

##### Collapsed menu / sidenav stories

Do NOT create a separate user story for each item in a sidenav, user menu, or tab bar. Instead, create ONE story per navigation surface and enumerate the items as a table inside the acceptance criteria — each row captures the label, icon (if material), destination, and feature-permission gate. Example AC:

> The user menu exposes the following items, each visible only when the named feature permission is enabled:
>
> | Label | Destination | Feature permission |
> |---|---|---|
> | Manage API Keys | `/portal/apikeys` | `API › Change API Keys` |
> | Direct Theme Builder | `/portal/directthemebuilder` | `Tenant Configuration › Direct Theme Builder` |
> | …

This keeps the shell area from ballooning into 30+ trivia stories.

#### 3d. Post-generation lint (mandatory)

After creating stories for an area, before presenting the summary, self-review the stories against the checks below. If any story fails, patch it (via `patchUserStory`) before showing the results to the user.

| Check | Trigger | Fix |
|---|---|---|
| AC implementation leak | Any acceptance criterion mentions a TypeScript identifier (`Component`, `Service`, `Subject`, `Observable`, `ngOnInit`, `canActivate`, `canDeactivate`, `checkFeatureEnabled(`, method-call syntax `name(...)`, or a route path used as routing-module config rather than a navigation destination). | Rewrite to user-observable wording using the examples above. |
| Title lacks user verb | Title has no verb from the allowed set (`see`, `view`, `open`, `create`, `edit`, `delete`, `submit`, `download`, `filter`, `sort`, `navigate`, `manage`, `invite`, `assign`, `approve`, `raise`, `escalate`, …). | Reword the title to state the outcome. |
| Persona not canonical | Story description's persona (`"As a …"`) is not a `title` from `brief.users` or the fallback `"any signed-in user"`. | Swap in the closest canonical persona; move any persona qualifier into acceptance criteria. |
| Story filed under wrong area | After each batch, `listUserStories` for the target area does not include every newly-created key. | Stop immediately. The story was filed elsewhere — find it, `patchUserStory` its `/areaId` to the correct area, and audit every other story created in the same run. |
| Thin area | Area ends with **fewer than 3 stories** after this pass. | STOP and ask the user: (a) merge with neighbouring area, (b) delete the area, (c) continue researching for missing capabilities. Do not silently leave a stub area. |
| Write verbs missing but implied | Area description mentions "manage", "CRUD", "provisioning", "configuration" etc. but the stories contain no create/edit/delete verbs and the capability matrix shows writes. | Add the missing stories before moving on. |

#### 3e. Present summary

After creating stories and running the lint, show a count, the persona mix used, and ask if the user wants to review any stories or continue to the next area.

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
- **Favour completeness over arbitrary targets** — cover every distinct capability the codebase exposes. Do not stop at any predetermined story count per area. Do not pad to hit one either.
- **No minimum or maximum acceptance-criteria count** — write as many as the story needs for thorough verification, and no more. The right number is a function of the story's scope, not a target.
- **Acceptance criteria are user-observable** — never cite component names, service names, method calls, route constants, guards, or other implementation identifiers in acceptance criteria. See Phase 3c.
- **Personas are drawn from `brief.users`** — do not mint ad-hoc persona phrasings per story. See Phase 3c.
- **Titles state outcomes, not locators** — `"Review the services I own"` beats `"Open /portal/services"`. Route URLs can appear in acceptance criteria as navigation destinations when helpful.
- **One story per navigation surface, not per item** — sidenavs, user menus, tab bars collapse into a single story whose AC enumerates the items as a table.
- **Halt on thin areas** — if an area ends with fewer than 3 stories after Phase 3d lint, ask the user before moving on.
- **Always pass `areaKey`, not `areaId`, on `createUserStory`** — semantic keys can't drift the way opaque UUIDs carried across batches can. Re-fetch via `listAreas` before each batch; verify via `listUserStories` after each batch.
- **Don't reference internal tooling** — this skill should work with any codebase and test framework. Don't hardcode paths to specific tools or scripts.
- **Description quality matters** — acceptance criteria should be specific enough that a developer or test framework can verify them. "Works correctly" is not an acceptance criterion.
- **Batch MCP calls** where possible to minimise round trips.

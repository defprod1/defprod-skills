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

#### 2c. Build a capability matrix

Before writing any stories, enumerate every entity the area exposes and record which verbs the codebase actually supports for it. This matrix is the coverage checklist for Phase 3.

| Entity | List | Detail | Create | Edit | Delete | State transitions | Validations | Permissions / feature gates |
|---|---|---|---|---|---|---|---|---|

If the area description mentions "manage", "CRUD", "provisioning", "configuration", or similar, the matrix must show the write verbs. If the codebase does NOT expose writes but the area description implies them, flag this to the user and consider updating the area description — the area is read-only in reality.

---

### Phase 3 — Create Stories

#### 3a. Establish the canonical persona list

Call `getBriefForProduct` (if not already fetched). Build the set of allowed persona titles from `brief.users[].title` (lowercased). Add one fallback: `"any signed-in user"` — usable for stories that cross personas (shell, profile, settings).

Every story's description MUST begin with `"As a <canonical persona>, I want to …"`. Do NOT invent ad-hoc persona variants ("customer user with Radware DDoS", "VISP user in the satellite wizard"). If the story only applies under a condition, put the condition in the acceptance criteria and keep the persona canonical.

#### 3b. Draft stories

Write stories covering every implemented capability in the capability matrix. Use these categories as a checklist — skip any that don't apply to this area:

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

Do NOT create a separate user story for each item in a sidenav, user menu, or tab bar. Collapse the navigation surface into ONE story whose AC lists the items as a table:

> The user menu exposes the following items, each visible only when the named feature permission is enabled:
>
> | Label | Destination | Feature permission |
> |---|---|---|
> | … | … | … |

#### 3c. Create stories via MCP

For each story, call `createUserStory` with:

- `title` — what the user can do, phrased as an outcome not a locator. Every title must contain a user-facing verb (`see`, `open`, `create`, `edit`, `delete`, `submit`, `download`, `manage`, `raise`, `escalate`, `invite`, `assign`, `approve`, …). "Invite team members by email" ✅ / "TeamInviteComponent" ❌ / "Open /team/invite" ❌.
- `key` — area key prefix + 2-digit zero-padded number, numbered up from 01 (e.g. `TEAM-01`, `TEAM-02`, `AUTH-01`). When adding to an area that already has stories, continue from the highest existing key.
- `areaKey` — the area's `key` (e.g. `TEAM`, `AUTH`). **Always prefer `areaKey` over `areaId`.** Opaque UUIDs carried in memory across batches drift silently and file stories under the wrong area; the semantic `areaKey` cannot. The backend also cross-checks that the story `key` starts with `${areaKey}-` and rejects mismatches.
- `description` — `"As a <canonical persona>, I want to <action> so that <benefit>."` Persona MUST come from the list built in Phase 3a.
- `status` — `completed` (these describe existing, implemented capabilities)
- `priority` — `high`, `medium`, or `low` based on the feature's centrality to the area
- `acceptanceCriteria` — see rules below

##### Acceptance criteria rules

- **Count: as many as are needed to thoroughly verify the story.** There is no minimum and no maximum. A simple read-only page may need 3; a multi-step wizard may need 12. Do not pad to hit a target and do not stop short to keep the story small. The right number is a function of the story's scope.
- **User-observable, not implementation.** Each criterion must describe something the user can see, do, or experience. Component names, service/DAO class names, method calls, route constants used as routing config (`Route X maps to YComponent`), `canActivate`/`canDeactivate`/`ChangeGuard`, RxJS primitives (`Subject`, `Observable`, `ngOnInit`), `checkFeatureEnabled(...)`, and other TypeScript identifiers do NOT belong in acceptance criteria. Route URLs are allowed only as navigation outcomes (e.g. "clicking Services lands on `/portal/services`"), not as routing-module config.

  | ❌ Implementation-leaky | ✅ User-observable |
  |---|---|
  | `Route /portal/services maps to PortalServiceListComponent with canDeactivate: [ChangeGuard] and breadcrumb 'My Services'.` | `Clicking "Services" in the sidenav shows the list of services with the breadcrumb "My Services". If the user has unsaved edits, they are prompted to confirm before navigating away.` |
  | `onFilterToggle('Show Closed', value) sets this.showClosed to the boolean value.` | `Toggling "Show Closed" includes decommissioned and cancelled services in the list; toggling it off hides them.` |
  | `The 'Manage API Keys' item is only rendered when checkFeatureEnabled(['API', 'Change API Keys']) is true.` | `The "Manage API Keys" menu item is visible only to users whose role includes the "Change API Keys" permission.` |

- **Testable.** Specific enough that an e2e or unit test could assert it. "Works correctly" is not an acceptance criterion.
- **Concrete values over adjectives.** "Up to 50 items per page" beats "a reasonable number".
- **One concern per criterion.** Split compound criteria into separate lines.

##### "Open the list at /X" archetype

Route-opening stories are valid, but their acceptance criteria must focus on what the user sees and can do on that page, not on the route configuration:
- Which personas / feature permissions make the entry point visible.
- What the user sees on first load (columns, default sort/filter, empty-state text).
- What actions are available and where they lead, from the user's point of view.
- What happens to unsaved edits on navigation away (when relevant).

Route wiring, component class names, and host-class selectors belong in architecture elements (a later skill), not in user stories.

Batch creation: create up to 10 stories per batch to keep interactions manageable.

**Before each batch**, call `listAreas` for the product to get the fresh `{_id, key, name}` mapping. Do not carry area identifiers in your head across batches — look them up every time. The `areaKey` you pass to `createUserStory` must come from this fresh lookup.

**After each batch**, call `listUserStories` for the target area and confirm every newly-created story key appears in the result. If any are missing, stop immediately and investigate — the missing stories landed under the wrong area.

#### 3d. Post-generation lint (mandatory)

Before presenting the summary, self-review every story created in this run. If a story fails any of the checks, patch it (`patchUserStory`) before proceeding.

| Check | Trigger | Fix |
|---|---|---|
| AC implementation leak | Any acceptance criterion mentions a TypeScript identifier ending in `Component`/`Service`/`Module`, a method call like `name(...)`, an RxJS primitive (`Subject`, `Observable`), Angular lifecycle/guard identifiers (`ngOnInit`, `canActivate`, `canDeactivate`, `ChangeGuard`), `checkFeatureEnabled(`, or a route string used as routing-module config rather than a navigation destination. | Rewrite to user-observable wording using the examples above. |
| Title lacks user verb | Title has no verb from the allowed set (`see`, `view`, `open`, `create`, `edit`, `delete`, `submit`, `download`, `filter`, `sort`, `navigate`, `manage`, `invite`, `assign`, `approve`, `raise`, `escalate`, …). | Reword the title to state the outcome. |
| Persona not canonical | Story description's persona is not a `title` from `brief.users` or the fallback `"any signed-in user"`. | Swap in the closest canonical persona; move qualifiers into acceptance criteria. |
| Write verbs missing but implied | Capability matrix shows write verbs (create/edit/delete/state-transition) for this area, but the stories contain none. | Add the missing stories before moving on. |
| Story filed under wrong area | After each batch, `listUserStories` for the target area does not include every newly-created key. | Stop immediately. The story was filed elsewhere — find it, `patchUserStory` its `/areaId` to the correct area, and audit every other story created in the same run. |
| Thin area | Area ends with **fewer than 3 stories** after lint. | STOP and ask the user: (a) merge with neighbouring area, (b) delete the area, (c) continue researching for missing capabilities. Do not silently leave a stub. |

#### 3e. Present summary

After creating stories and running the lint, present:

| Area | Stories Created | Categories Covered | Personas Used |
|------|----------------|--------------------|---------------|
| {area} | {count} | {list} | {list} |

Show the story titles as a checklist. Ask the user:

> **Review the stories above.** Would you like to:
> - **Adjust any stories** — I can update titles, descriptions, or acceptance criteria
> - **Continue** — the stories look good, move on

---

## Rules

- **All stories are `completed`** — this skill describes existing capabilities, not planned work. Every story should reflect something the codebase already implements.
- **Every field on every story must be populated** — no empty descriptions, no missing acceptance criteria.
- **Favour completeness over arbitrary targets** — if an area has 20 distinct capabilities, create 20 stories. Don't stop at 5 or 10.
- **No minimum or maximum acceptance-criteria count** — write as many as the story needs for thorough verification, and no more. The right number is a function of story scope.
- **Acceptance criteria are user-observable** — never cite component names, service names, method calls, route constants used as config, or other implementation identifiers. See Phase 3c.
- **Personas are drawn from `brief.users`** — do not mint ad-hoc persona phrasings per story. See Phase 3a.
- **Titles state outcomes, not locators** — route URLs can appear in acceptance criteria as navigation destinations when helpful.
- **One story per navigation surface, not per item** — sidenavs, user menus, tab bars collapse into a single story with a table of items in acceptance criteria.
- **Halt on thin areas** — if an area ends with fewer than 3 stories after lint, ask the user before moving on.
- **Keys must be unique within the product** — use the area key as prefix followed by a 2-digit zero-padded number (e.g. `AUTH-01`, `AUTH-02`). When adding to an area that already has stories, continue numbering from the highest existing key.
- **Always pass `areaKey`, not `areaId`** — semantic keys can't drift the way opaque UUIDs carried across batches can. Re-fetch via `listAreas` before each batch; verify via `listUserStories` after each batch.
- **Acceptance criteria must be testable** — specific enough that a developer could write an automated test from them. "Works correctly" is not a criterion.
- **Don't invent capabilities** — only create stories for features you can verify exist in the codebase. If unsure whether something is implemented, check the code.
- **Batch MCP calls** where possible to minimise round trips.

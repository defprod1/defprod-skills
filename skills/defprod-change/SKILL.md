---
name: defprod-change
description: Drive a change record end-to-end through the DefProd pipeline — pull an accepted ticket from your tracker, create the change, then walk it stage by stage under your product's pipeline config until a human gate, a CI/CD handoff, or shipment. Use when starting any tracked piece of change work (feature, enhancement, or bug).
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
  - mcp__defprod__createChange
  - mcp__defprod__listChanges
  - mcp__defprod__getChange
  - mcp__defprod__patchChange
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
  - mcp__defprod__cancelChange
  - mcp__defprod__reopenChange
---

# Drive a Change

The generic, type-blind orchestrator for change work. It owns the end-to-end
process — intake from your tracker, change-record creation, and the stage loop —
but does **no stage work itself**: each stage is performed (and stamped) by its
stage skill, and the loop yields to humans and CI/CD exactly where your
product's pipeline config says it should.

## When to use

- When starting a tracked piece of change work: `/defprod-change PROJ-123`,
  `/defprod-change <ticket-url>`, or bare `/defprod-change` for ad-hoc work.
- `/defprod-implement-feature` and `/defprod-fix-bug` are thin shims onto this
  skill with the type preset.

## Concepts

- **Change record** — a product-scoped work record in DefProd with a key like
  `CHG-07`, tracking intent, origin, and pipeline position.
- **Pipeline** — the product's enabled stages, a subsequence of:
  accept → design → define → code → test → review → merge → push → build →
  package → staging → ship. Read it from `getProduct` → `changePipeline`
  (entries `{stage, enabled, driver}`; missing entries default to enabled with
  default drivers: accept=human; design/define/code/test/review/merge/push=agent;
  build/package/staging/ship=cicd).
- **Driver** — who executes a stage: `human`, `agent`, or `cicd`. The driver
  map IS the orchestration policy.

## Workflow

### Step 1 — Resolve the product

Identify the DefProd product for this repo (`.defprod/defprod.json` hint, or
`listProducts` + ask the user). Fetch it with `getProduct` and resolve the
pipeline config as above.

### Step 2 — Fetch the ticket (intake)

- **With a ticket ref/URL**: fetch it via the **`/defprod-change-tracker`**
  adapter skill (the user-owned skill that knows how to talk to your tracker).
  If the adapter is unfilled or absent, fall back to asking the user to paste
  the ticket content or describe the work.
- **Bare invocation**: this is ad-hoc internal work — compose the intent
  interactively with the user.

Classify the **type** (`feature` | `enhancement` | `bug`) from the ticket or
ask. Distill the **intent** (markdown: what we are changing and why — the
accepted decision, not a paste of the ticket) and **confirm it with the user
before creating anything**.

### Step 3 — Dedupe, then create the change

For external tickets, check for an existing promotion first:
1. Ask the adapter whether the ticket already carries a DefProd change link.
2. Call `listChanges { productId, originSystem, originRef }`.

If an **active** change exists → resume it (re-establish context, continue at
Step 5) instead of creating a duplicate. If a **cancelled** one exists →
prefer `reopenChange` over creating anew. The server independently rejects
duplicate creation against active changes.

Otherwise call `createChange` with `{ productId, title, type, intent,
source: 'external' | 'internal', origin: { system, ref, url } }` (origin and
`source: external` only for tracker-originated work).

### Step 4 — Establish the change context

Make the change discoverable by stage skills and CI hooks:

1. Write **`.defprod/change`** (git-ignored; add to `.gitignore` if needed) in
   the worktree root:
   `{ "productId": "...", "changeId": "...", "changeKey": "CHG-NN" }`
2. In branch-based flows, create the branch **`chg/CHG-NN-<short-slug>`**.
3. (Commits made later by `/defprod-change-land` carry the
   `Change: CHG-NN` trailer.)

Then perform the **link write-back**: ask the adapter to mark the ticket
promoted with the change key (`link` operation).

### Step 5 — The stage loop

Repeat until the pipeline ends or control leaves the agent:

1. Fetch the change (`getChange`) and **re-read the pipeline config** — never
   plan the whole run upfront; config and position may have changed.
2. Determine the next enabled stage after the current position.
   - No next stage → the change is shipped or at pipeline end; go to Step 6.
3. Consult that stage's **driver**:
   - **`human`** → STOP. Present the change's position, what the stage needs,
     and wait for the user's instruction. Do not proceed on your own.
   - **`cicd`** → END the run. Report that the change is handed to the
     CI/CD pipeline (its hooks stamp `finishChangeStage` from here — see
     `defprod-stamp.sh` in defprod-scripts).
   - **`agent`** → invoke the stage's skill, passing the change type:

     | Stage | Skill |
     |-------|-------|
     | design | `/defprod-change-design` |
     | define | `/defprod-change-define` |
     | code | `/defprod-change-code` |
     | test | `/defprod-change-test` |
     | review | `/defprod-change-review` |
     | merge, push | `/defprod-change-land` (handles both) |
     | build, package, staging, ship | no skill — cicd territory |

     **Capability dispatch**: if the repo has a local override skill for the
     stage (e.g. a project-specific `change-test`), prefer it — stamping
     behaviour is identical because each stage skill stamps itself.
4. The stage skill stamps its own start/finish — the orchestrator never calls
   the stamping RPCs for stage work it delegated.

### Step 6 — Terminal write-back

When the change reaches `ship` finished (or is cancelled), ask the adapter to
write the outcome back to the ticket (`close` operation). Best-effort: a
failed tracker write is reported, never blocking.

## Rules

- **Re-consult the driver map every iteration.** A human gate must never be
  steamrolled because an earlier plan said "continue".
- **The intent field is the accepted decision** — confirmed by the user, not a
  ticket paste.
- **Never write lifecycle state via patch** — position moves only through the
  stage-action tools.
- **One change at a time per worktree** — `.defprod/change` pins it; parallel
  changes belong in separate worktrees or branches.
- Mid-flight tracker sync is out of scope: DefProd is the source of truth
  between the link and close bookends.

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

> **Local extensions.** If a file named `SKILL.local.md` exists in this skill's
> directory, read it now and fold it into the steps below. It records this
> installation's local policies, additions, and overrides; where it conflicts
> with the instructions here, the local file takes precedence.

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
  map IS the orchestration policy. For stages backed by an agent stage-skill,
  the orchestrator translates the driver into an execution **mode** it passes to
  the skill: `agent` → `autonomous` (run to completion, no questions),
  `human` → `interactive` (clarify as needed, and **never finish the stage
  without explicit human approval**). `cicd` hands the stage to CI/CD.
- **Driver overlay** — a per-run `stage → driver` map the caller supplies at
  invocation that takes precedence over the product's `changePipeline` driver,
  **for this run only**. It is never written back to the product (no
  `patchProduct`) — it is a caller override, not a config edit. Resolution
  precedence (high → low): explicit per-stage override → shorthand → product
  config entry → built-in default. The overlay changes only the **resolved
  driver**; the driver→mode translation above and the stage skills themselves
  are unchanged. Constraints: it may set only `human`/`agent`, and only for
  skill-backed stages (design/define/code/test/review/merge/push) — it cannot
  hand a skill-less cicd stage (build/package/staging/ship) an agent to run, so
  such an override is ignored with a note. See **Driver overrides** below.

## Driver overrides (per-run)

The caller can override stage drivers for a single run without editing the
product's pipeline config. Pass overrides as invocation args alongside the
ticket ref (they coexist):

- **`--auto`** (alias `autonomous`) — flip every **skill-backed** stage to
  `agent`. The intent is **still confirmed with you** before the change is
  created, and the `accept` gate is preserved. Use when you're confident the
  build can run hands-off but still want to approve *what* is being built.
- **`--auto-all`** (alias `yolo`) — everything `--auto` does, **plus**
  auto-confirm the distilled intent and the `accept` gate: zero prompts from
  invocation to the CI/CD handoff (or ship). Use only when you're confident the
  change can go all the way through unattended.
- **`--interactive`** (alias `review-all`) — flip every skill-backed stage to
  `human` (each keeps you in the loop and won't finish without approval).
- **`<stage>=<driver>`** — fine-grained per-stage override, space-separated and
  combinable with a shorthand; explicit pairs win. `<driver>` ∈ {`human`,
  `agent`}. E.g. `--auto review=human` runs everything autonomously except
  review, which stays a human gate.

Examples:

```
/defprod-change PAY-12 --auto                 # loop autonomous; you still confirm the intent
/defprod-change PAY-12 --auto review=human    # autonomous except a human review gate
/defprod-change PAY-12 code=agent review=human
/defprod-change --auto-all                    # bare ad-hoc work, fully unattended
```

The same overrides flow through the `/defprod-implement-feature` and
`/defprod-fix-bug` shims. Invocation args, when present, **replace** any overlay
persisted from an earlier run; absent args, the persisted overlay stands.

## Workflow

### Step 1 — Resolve the product

Identify the DefProd product for this repo. One repo may host **several**
products (a monorepo), so resolve by this ladder — first match wins:

1. **Config fast path.** Read `.defprod/defprod.json` (the committed, non-secret
   config — also the home of `apiUrl`, `repoId`, and layout hints). If it pins a
   single `productId`, use it — the common single-product case, unchanged.
2. **Repo linkage.** Otherwise take `repoId` from the config and list the team's
   products (`listProducts`), keeping those whose `repoId` matches. This is the
   repo↔product linkage — the product carries its own `repoId`/`repoPackagePath`.
   - Exactly one candidate → use it.
3. **Narrow by package path.** More than one → narrow by `repoPackagePath`:
   keep candidates whose path is the sub-tree the change's files live under.
4. **Narrow by working area.** Still ambiguous (two products share a
   `repoPackagePath` — e.g. two apps served from one package) → narrow by the
   route/area the changed files belong to.
5. **Ask.** Still ambiguous, or no `repoId`/candidates at all → `listProducts`
   and ask the user, presenting candidates by **slug** and name.

Fetch the resolved product with `getProduct`, **note its `slug`** (carried into
the change context in Step 4 for the land trailer), and resolve the pipeline
config as above.

Then resolve the **driver overlay** from the invocation args (see *Driver
overrides*). Apply it on top of the pipeline config and **echo the effective
driver map**, marking overridden stages (e.g. `review: agent * ← was human`),
then proceed — no confirmation prompt. Ignore (and note) any override targeting
a skill-less cicd stage.

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
before creating anything**. Under **`--auto-all`**, skip this confirmation and
the `accept` gate — the distilled intent is accepted as-is and recorded as the
change's intent. `--auto` does **not** skip it: you still confirm *what* is
being built.

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
   `{ "productId": "...", "changeId": "...", "changeKey": "CHG-NN", "productSlug": "..." }`
   (`productSlug` is the resolved product's slug from Step 1 — the land stage
   uses it for the `Change: <slug>/CHG-NN` trailer without a round-trip.)
   **The pin is a lock, not a claim.** Before writing it, read any existing
   `.defprod/change` and check it: if it names a **different** change, `getChange`
   it — if that change is still **active** (not shipped/cancelled), this worktree
   is already hands-on for another change. **Refuse** to overwrite the pin and
   stop with a clear message (the other change's key + its branch), unless the
   operator explicitly forces it (`--force`). A leftover pin from a
   **shipped/cancelled** change is stale — replace it freely. This makes two
   sessions unable to silently share one tree: the second change must be forced,
   or belongs in a separate worktree/branch. If a driver overlay was resolved in
   Step 1, persist it here too as a `driverOverrides` object (e.g.
   `"driverOverrides": { "review": "human", "code": "agent" }`) so the override
   survives a CI/CD-handoff → resume cycle. It is cleared with the pin on
   ship/cancel.
2. In branch-based flows, create the branch **`chg/CHG-NN-<short-slug>`**.
3. (Commits made later by `/defprod-change-land` carry the
   `Change: <product-slug>/CHG-NN` trailer.)

Then perform the **link write-back**: ask the adapter to mark the ticket
promoted with the change key (`link` operation).

### Step 5 — The stage loop

Repeat until the pipeline ends or control leaves the agent:

1. Fetch the change (`getChange`) and **re-read the pipeline config** — never
   plan the whole run upfront; config and position may have changed. Then
   **re-apply the run overlay** (the resolved overrides, persisted in
   `.defprod/change` as `driverOverrides`) so the override is honoured every
   iteration and survives a resume.
2. Determine the next enabled stage after the current position.
   - No next stage → the change is shipped or at pipeline end; go to Step 6.
3. Consult that stage's **driver** and act:
   - **`cicd`** → END the run. Report that the change is handed to the
     CI/CD pipeline (its hooks stamp `finishChangeStage` from here — see
     `defprod-stamp.sh` in defprod-scripts).
   - **`agent`** or **`human`** on a **skill-backed** stage → invoke the stage's
     skill, passing the change type **and the mode**: `agent` → `mode=autonomous`,
     `human` → `mode=interactive`. In interactive mode the skill keeps the human
     in the loop and will **not** `finishChangeStage` without explicit approval,
     so a human gate is honoured *inside* the stage — not by stopping the loop
     before it. (This replaces the earlier "human → stop the loop" rule: the
     approval-before-finish gate is now the control point. After the stage
     finishes, continue the loop — re-read the config and consult the next
     stage's driver.)
   - **`human`** or **`agent`** on a **skill-less** stage (`build`, `package`,
     `staging`, `ship` — CI/CD territory) → nothing for the agent to run: hand
     off as for `cicd`, or STOP and report if a human must act.

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

On cancellation (`cancelChange`), also **delete `.defprod/change`** — a
cancelled change is no longer hands-on in the worktree. (On `ship`, the pin was
already cleared at the land hand-off, Step 5 / `change-land`.)

## Rules

- **Re-consult the driver map every iteration.** A human gate must never be
  steamrolled because an earlier plan said "continue". The gate now lives in
  the stage skill's **interactive** approval-before-finish, so "continue" means
  re-reading the next stage's driver and invoking its skill with the right
  mode — never advancing a `human`-driven stage to `finished` unprompted.
- **Driver overrides are per-run, never config.** Resolve the overlay on top of
  the freshly-read config each iteration; never `patchProduct`. Precedence:
  explicit pair → shorthand → config → default. The overlay sets only
  `human`/`agent` on skill-backed stages — a skill-less cicd stage can't be
  overridden to agent. Echo the effective map once at run start; don't prompt.
- **The intent field is the accepted decision** — confirmed by the user, not a
  ticket paste. (`--auto-all` accepts the distilled intent as-is; `--auto` does
  not.)
- **Never write lifecycle state via patch** — position moves only through the
  stage-action tools.
- **One change at a time per worktree** — `.defprod/change` **locks** it: Step 4
  refuses to claim a tree already pinned to a *different active* change (override
  only with `--force`), so parallel changes cannot silently share a tree — they
  belong in separate worktrees or branches. The pin is cleared at the land
  hand-off and on cancel, and stage skills **self-heal** a stale pin on read
  (validate the pinned change is active; delete it if shipped/cancelled), so a
  leftover pin never traps the next change. As a backstop against a tree that
  drifts *mid-stage*, `/defprod-change-land` re-validates branch/pin consistency
  before committing and aborts on mismatch. Invariant: *pin present ⇔ a change is
  hands-on in this worktree*.
- Mid-flight tracker sync is out of scope: DefProd is the source of truth
  between the link and close bookends.

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
  - mcp__defprod__getEffectiveChangePipeline
  - mcp__defprod__assessChangeRisk
  - mcp__defprod__recordChangeDefect
  - mcp__defprod__confirmChangePipeline
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
  package → staging → ship. For a change in flight, read the one it is actually
  running under from `getChange` → `effectivePipeline`; the product's standing
  configuration is `getProduct` → `changePipeline` (entries
  `{stage, enabled, driver}`; missing entries default to enabled with default
  drivers: accept=human; design/define/code/test/review/merge/push=agent;
  build/package/staging/ship=cicd). The two differ exactly when the repository has
  given the change's confirmed pipeline authority.
- **Driver** — who executes a stage: `human`, `agent`, or `cicd`. The driver
  map IS the orchestration policy. For stages backed by an agent stage-skill,
  the orchestrator translates the driver into an execution **mode** it passes to
  the skill: `agent` → `autonomous` (run to completion, no questions),
  `human` → `interactive` (clarify as needed, and **never finish the stage
  without explicit human approval**). `cicd` hands the stage to CI/CD.
- **Risk assessment** — a scored severity / occurrence / detection vector with
  per-axis evidence, recorded on the change by `assessChangeRisk` (Step 5). The
  **agent scores; the server resolves**: the *risk category* (`low` | `medium` |
  `high`) is derived from the vector and is never an input. Assessment is an
  activity *within* `accept`, not a pipeline stage, and is re-scored at the
  `design` and `code` boundaries. Whether the category **selects** the pipeline is
  the repository's decision: where it grants confirmed pipelines authority, the
  change runs under the one confirmed for it; where it does not, the category is
  recorded and reported and selects nothing. You never have to work that out —
  `getChange` reports the pipeline in force and which of the two it came from.
- **Pipeline confirmation** — freezing onto the change, in full, the pipeline its
  category selected, via `confirmChangePipeline` (Step 5). The category is not an
  input here either: the server reads it from the change's own assessment and
  resolves the pipeline from it. A repo may declare bands it confirms
  **automatically** (`low` by default), in which case `assessChangeRisk` performs
  the confirmation itself and no separate call is wanted. Confirmation is a
  *record of what was selected*. Whether it is also **authority** is the repo's
  call: where the repo grants it, that frozen pipeline is what drives the change,
  and a later config edit cannot reach the change in flight; where it does not,
  the confirmation changes nothing about how the change is driven.
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

### Change-key qualification (single- vs multi-product repos)

This resolution ladder settles more than which product owns the change — it
also settles this repo's **cardinality**, which gates every *prose* rendering
of a change key from here on:

- **Single-product repo** — the config fast path (rung 1) pinned one
  `productId` outright, or the repo-linkage lookup (rung 2) returned exactly
  one candidate before any narrowing was needed.
- **Multi-product repo** — the repo-linkage lookup (rung 2) returned **more
  than one** candidate, and rungs 3–5 narrowed to the one in scope for this
  change.

**The rule:** in a multi-product repo, every *prose* rendering of a change key
that this pipeline authors — commit subject/body, PR title/body,
`defprod-change-tracker` link/close write-backs, and any change-key mention
inside the change record's own narrative content (the `intent` composed below,
or the `design` field a stage skill records) — renders qualified,
`<product-slug>/CHG-NN`. In a single-product repo, all of those render **bare**,
`CHG-NN`, full stop. Echo which case applies once, alongside the product
resolution (e.g. "3 products share this repo — change-key mentions qualify as
`defprod/CHG-NN`" or "single product repo — change-key mentions stay bare"),
then proceed without asking.

**This does not govern the commit trailer or the branch name** — both stay
unconditionally qualified whenever a product resolves (Step 4), unchanged
since v1.7.0/v1.13.0: CI's stamping (`defprod-stamp.sh`) depends on that fixed
form regardless of cardinality.

**This is the single statement of the rule.** Persist the determination as
`multiProduct` in the `.defprod/change` pin (Step 4) so stage skills read it
rather than re-deriving cardinality themselves (most don't carry `listProducts`
in their tool allowlist). Every site that renders a change key as prose
cross-references this section rather than restating the policy — one edit
here, not N.

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
being built. If the intent text mentions another change (a duplicate, a
superseded predecessor, a related sibling), render that mention per
*Change-key qualification* above.

### Step 3 — Dedupe, then create the change

For external tickets, check for an existing promotion first:
1. Ask the adapter whether the ticket already carries a DefProd change link.
2. Call `listChanges { productId, originSystem, originRef }`.

If an **active** change exists → resume it (re-establish context, continue at
Step 6) instead of creating a duplicate. If a **cancelled** one exists →
prefer `reopenChange` over creating anew. The server independently rejects
duplicate creation against active changes.

Otherwise call `createChange` with `{ productId, title, type, intent,
source: 'external' | 'internal', origin: { system, ref, url } }`.

**`origin` and `source` are independent — never condition one on the other.**
They answer different questions:

- **`origin` — where is this work written down?** Pass the origin the adapter
  returned from `fetch`, **whenever intake fetched a ticket at all**, whatever
  its source. Omit it only for genuinely ad-hoc work — a bare invocation with
  no ticket behind it — because there is then nothing to point at.
- **`source` — did this work come from outside the team?** `external` for a
  customer, a partner, an outside report; `internal` for the team's own
  backlog. A team's own tracker is still a tracker, so `internal` **with** an
  origin is the normal case, not a contradiction.

A change promoted from a ticket but carrying no `origin` is a defect, not a
tidy omission: the ticket records the change key, the change records nothing,
and the change's own detail view has no origin to show. Treating
`source: external` as the trigger for setting `origin` is the specific mistake
that produces it.

### Step 4 — Establish the change context

Make the change discoverable by stage skills and CI hooks:

1. Write **`.defprod/change`** (git-ignored; add to `.gitignore` if needed) in
   the worktree root:
   `{ "productId": "...", "changeId": "...", "changeKey": "CHG-NN", "productSlug": "...", "multiProduct": true|false }`
   (`productSlug` is the resolved product's slug from Step 1 — the land stage
   uses it for the `Change: <slug>/CHG-NN` trailer without a round-trip.
   `multiProduct` is the cardinality determination from *Change-key
   qualification* above — stage skills read it directly instead of
   re-resolving cardinality.)
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
2. In branch-based flows, create the branch **`chg/<product-slug>/CHG-NN-<short-slug>`** — the `<slug>/CHG-NN` tail matches the commit trailer (D23). (Legacy bare `chg/CHG-NN-<short-slug>` branches are still recognised by the stage skills and CI.)
3. (Commits made later by `/defprod-change-land` carry the
   `Change: <product-slug>/CHG-NN` trailer.)

Then perform the **link write-back**: ask the adapter to mark the ticket
promoted with the change key (`link` operation).

**Then confirm the link points both ways.** A promotion is one fact recorded in
two places, and only one of them is a deliberate step — so the forward half is
the half that goes missing. Re-read the change (`getChange`) and check its
`origin` matches the ticket you just linked. If it is absent, the create call
dropped it: repair it now with `patchChange` — `/origin` is patchable, unlike
the lifecycle and provenance fields around it — rather than leaving a one-way
record. If your client cannot pass nested arguments through an MCP tool call
(some mangle objects in transit), reach for whatever direct RPC path the repo
has instead of giving up and proceeding with no origin.

**Do it here, at the boundary — not later.** This check is worth the round-trip
because the repair window closes: a **shipped change is frozen**, and
`patchChange` refuses it outright with no override. Nothing between here and
ship catches a missing origin, so the change sails through, and by the time a
human notices the empty origin on the change detail and asks where the work
came from, the record can no longer be corrected at all.

### Step 5 — Assess the risk (an activity within `accept`)

The change now exists and has an id, so score it. Assessment is an **activity
within `accept`, never a pipeline stage** — as a stage, every later re-score
would be a backward jump, and the backward-jump rule would wipe the stamps of
design, define, code and everything after them, so re-assessing would destroy the
record's own history. This step therefore calls no stage-action tool, moves no
position, and disturbs no stamps.

**If assessment is unavailable, skip it and continue.** `assessChangeRisk` is
gated by a feature flag and exists only on servers new enough to carry it. A
rejection — flag off, tool absent, insufficient scope — is **not** a pipeline
failure: note it in one line and go to Step 6. Risk assessment never blocks
change work.

1. **Do the lookups before scoring.** `assessChangeRisk`'s own tool description
   states what each axis's evidence must contain — read it and satisfy it rather
   than guessing. An axis without evidence is rejected, because an unsupported
   score is not an assessment. Two errors are worth naming because they invert
   the outcome:
   - **Detection is INVERTED** — `1` = certain to be caught before a customer
     sees it, `10` = silent.
   - **An unfamiliar subsystem scores occurrence HIGH, not low.** Unfamiliarity
     is an argument for a high occurrence, never a reason to shrug one off.
2. **Score what is knowable at `accept`, and be explicit about what is not.**
   Here the change is still an intent string: no diff exists, so the modules
   touched and the coverage over the changed path are unknown. This is the
   **least-informed score the change will ever have** — expected, not a defect.
   Use the prior art in this repo, `docs/rules` (or this repo's equivalent), and
   the incident record for occurrence; for detection, say plainly that no diff
   exists yet and name whatever coverage exists over the surface the intent
   implicates — or record that none does. **Do not invent diff-level evidence you
   cannot have at this point.**
3. **Use the `core` overlay.** Whether a migration is involved is usually not
   known at `accept`, so the initial assessment is scored against the core
   anchors and omits `writeSet` / `sideEffects`. The `dbm` overlay — which
   requires both declarations, empty arrays permitted but stated explicitly —
   belongs to a later re-score, once a migration is known to be in play.
4. **Never supply a category.** It is not an input: the server derives it from
   the vector by a severity-weighted lookup and rejects a supplied one. The only
   way to move the category is to move an axis **and** write the evidence for
   that axis. Compute one locally to *report* if you wish — you simply cannot
   assert one as stored truth.
5. **Report the resolved category** from the response
   (`riskAssessment.category`), with the vector and a one-line reason per axis.
6. **Report the pipeline the category selects, and whether it governs.** Call
   `getEffectiveChangePipeline { productId, riskCategory }` for the resolved
   category, and read `effectivePipeline` / `effectivePipelineSource` from the
   change itself for what is actually in force, then show the difference between them
   — or state that there is none.
7. **Confirm the pipeline** — freeze onto the change the pipeline its category
   selected, so the record still answers *"what oversight did this change
   receive?"* after the configuration has moved on.

   **First check whether it is already done.** Where the repo auto-confirms the
   resolved band — `low` unless it says otherwise — `assessChangeRisk` performed
   the confirmation itself, and the response comes back with
   `confirmedPipelineCategory` already set. Report that it was confirmed
   automatically and **do not call `confirmChangePipeline`**; a second call would
   add a duplicate entry to the change's history for a confirmation that did not
   change. Auto-confirmation is the whole reason a routine change costs no human
   touchpoint here — do not reintroduce one.

   Otherwise the band needs confirming explicitly. Call
   `confirmChangePipeline { changeId }`. Supply **no** category and **no**
   pipeline: both are resolved server-side from the change's own assessment,
   which is what stops a caller confirming lighter oversight than the evidence
   earned. Pass per-stage `overrides` only if the repo has opted into them —
   where it has not, supplying them is **rejected**, not ignored, so a refusal
   naming `allowConfirmedPipelineOverride` means the repo is in its strict
   default, not that you called it wrongly.

   **Consent follows the driver, as everywhere else.** With a human in the loop
   (default, and under `--auto`, which preserves the `accept` gate), present the
   pipeline and confirm it with them before calling — this is the one moment
   the design intends a human to see the oversight level before it is recorded.
   Under `--auto-all`, confirm without prompting.

   **If confirmation is unavailable, note it and continue**, exactly as for
   assessment: the tool is gated by the same flag and exists only on servers new
   enough to carry it. It never blocks change work.

**Whether any of this reshapes the run is the repository's decision, not yours to
infer.** `getChange` reports `effectivePipelineSource` — `confirmed` (the frozen
confirmation governs), `assessed` (no confirmation stands, so the stricter of the
configuration and the current category governs), or `configuration` (the standing
config governs, because the repo has not granted authority or the change carries no
assessment). Report which one applies, in those terms, so the reader is never left
guessing whether a category they can see actually gated the change.

Where the source is `configuration`, say so plainly and run Step 6 exactly as if
no assessment had been made — that is the calibration posture, in which the value
is in the assessment being recorded and read rather than applied.

A confirmed pipeline does **not** change this. It records *what the category
selected*; the run still proceeds under the pipeline in force. Confirming and
applying are separate, and only the first exists today.

Assessment itself needs no gate in any driver mode — nothing is applied, so there
is nothing to approve. Report and continue under `--auto`, `--auto-all` and
`--interactive` alike. Confirmation is the exception noted above, because a human
choosing an oversight level is the point of it.

### Step 6 — The stage loop

Repeat until the pipeline ends or control leaves the agent:

1. Fetch the change (`getChange`) and **take the driver map from its
   `effectivePipeline`** — the pipeline this change is actually running under,
   already resolved by the server, with `effectivePipelineSource` naming which of
   the three it came from. Re-read it **every iteration**: never plan the run
   upfront, because the change's position, its assessment and the repo's policy
   can all move underneath you — including the withdrawal of authority, which is
   an emergency brake and must bite in flight.

   Where `effectivePipeline` is **absent** — an older server that predates it —
   fall back to the product's pipeline config (`getEffectiveChangePipeline`, or
   `getProduct` → `changePipeline`) exactly as before, and treat the source as
   `configuration`. Never synthesise the field from a repo setting yourself: the
   ladder that produces it is the server's, and guessing it is how a run ends up
   driven under a pipeline nobody selected.

   Then **re-apply the run overlay** (the resolved overrides, persisted in
   `.defprod/change` as `driverOverrides`) so the override is honoured every
   iteration and survives a resume. The overlay is the caller's, so it still sits
   on top — a `--auto` run is autonomous whatever the risk category selected.
2. Determine the next enabled stage after the current position.
   - No next stage → the change is shipped or at pipeline end; go to Step 7.
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
5. **If the stage that just finished was `design` or `code`, re-assess the risk**
   before continuing the loop — see *Re-assessment at the design and code
   boundaries* below.
6. **If the stage that just finished was `code` and the change is a `bug`,
   classify the defect it repaired** — see *Defect classification after `code`*
   below. Then continue at 1.

#### Defect classification after `code`

A `bug` change repaired a defect. Record what kind it was, with
`recordChangeDefect`, once the diff exists.

**An activity, never a pipeline stage** — for the same reason risk assessment is
one. It calls no stage-action tool, moves no position and disturbs no stamps.
Anchored to the `code` boundary rather than to a stage because pipelines are
per-band configurable: hanging it off `review` would skip it for exactly the
low-risk changes whose defect data is most worth having.

**After `code`, not at `accept`.** Half the fields need the diff — what had to be
fixed, and the nature of the mistake, are fiction before the fix exists.

**It never blocks.** A tool that is absent, refused, or on a server too old is one
line of note and then carry on. Nothing here may stop a fix shipping.

1. **One classification, the most severe defect.** Where the fix repaired
   several, rank by who they affected — customer beats staff beats developer —
   and break ties by impact severity. Record that one and let the rest go. The
   number this produces is *customer-facing defects*, not *defects*.
2. **Score impact severity on the risk rubric's Severity anchors**, the same ones
   used to predict a change's severity, and **within the audience you named**.
   The anchors assume a customer, so a staff-only defect that breaks a core admin
   workflow reads as an 8 and overstates its business impact badly.
3. **`foundBy` is what actually exposed it**, not what should have. It is the
   cheapest field here — you already know how you found the bug — and the one
   that says which gate is worth investing in.
4. **Give the commit, not the change.** `git bisect` / `git log -S` / `blame`
   returns a SHA; pass it as `introducedInCommit`, pass that commit's `Change:`
   trailer as `introducedInCommitTrailer`, and let the server derive the change
   link and the dormancy. Do not look a change up yourself. Where the defect is in
   code that never worked there is no introducing commit — record `age: base` and
   omit both rather than guessing.
5. **It can be amended after ship**, unlike every other content field. Realised
   impact is often only learned once a customer explains what actually happened,
   so a later correction is the system working; the history is kept in the change
   event trail.

#### Re-assessment at the design and code boundaries

Re-scoring is **mandatory at the end of `design`** — scope and approach are now
known — and **at the end of `code`**, where the diff exists and the rubric can
finally run its lookups for real. If either stage is disabled or skipped in this
product's pipeline, its boundary simply doesn't exist; re-assess after each of the
two that actually ran.

It is the same `assessChangeRisk` call as Step 5, with the same evidence
discipline and the same tolerance: if assessment is unavailable, note it in one
line and carry on. Re-scoring is always safe — the current assessment is replaced,
the full history is kept in the change's event trail, and no stage position or
stamp is touched. **The orchestrator owns this**, not the stage skills: keeping it
here means it still happens when a repo substitutes its own local override skill
for a stage, and it cannot double-score. A stage skill invoked standalone
therefore does not re-assess.

Three things differ from the `accept`-time score:

1. **The lookups are real now — do them properly.** At `code`-end especially, run
   coverage over the changed paths and name the specific test that would fail on
   the failure mode, or state plainly that none exists. This is the assessment the
   earlier one was standing in for, so **do not carry forward `accept`-time
   evidence strings the diff has since superseded** — rewrite them.
2. **The overlay may change.** The initial score is always `core`, because whether
   a migration is involved usually isn't known at `accept`. Once one is in play,
   switch to the `dbm` overlay — at which point `writeSet` **and** `sideEffects`
   are both required, empty arrays permitted but stated explicitly rather than
   omitted, and reversibility is derived from those declarations and overrides your
   authored value unless you record a justification.
3. **Report the movement, not just the value.** Compare against the previous
   category and say whether it rose, fell, or held.

**Application is asymmetric — a ratchet on the band, not on individual axes.**
Raising oversight is always safe to automate; lowering it is precisely what a
human was consulted about.

- **Category rose** → the earlier pipeline choice was made against a risk picture
  now known to be wrong, so re-selection is **forced**: the stricter preset
  applies and is **announced**, not asked about, in every driver mode.
- **Category fell** → the pipeline **does not relax**. You may *propose*
  relaxation to a human; you may never apply it, because an agent does not reduce
  oversight below an explicit human choice. Under `--auto` / `--auto-all` a fall
  is **recorded and ignored** — no prompt, no relaxation. A fall is often
  legitimate and earned — adding a test that fails on the identified failure mode
  is the cheapest way there is to lower detection — which is why falls travel the
  proposal path rather than being discarded.

**Whether a rise reshapes the run depends on the repository, and you do not have
to work it out.** Re-read `effectivePipeline` after the re-score: where the repo
grants authority, a rise genuinely tightens the run — the confirmation it cleared
drops the change onto the stricter of the configuration and its new category, so
the remaining stages are driven under that from the next iteration onward, and you
announce it rather than asking. Where the repo has not granted authority, the
source stays `configuration`: state that the category rose, name the stricter
pipeline it *would* have selected, and continue under the pipeline in force. The
fall branch is a proposal in both cases.

**Re-confirm when the category moves, because the server invalidates.** A
re-assessment that lands the change in a band the repo does *not* auto-confirm
**clears** any existing confirmation — otherwise a change assessed `low`,
auto-confirmed, then re-scored `high` at the `design` or `code` boundary would
carry a record reading "low oversight confirmed" against high-risk work. So after
a re-score that moved the category:

- **Into an auto-confirmed band** → the server has already replaced the
  confirmation. Report it; call nothing.
- **Into any other band** → the confirmation is now cleared, and the change has
  none. Confirm again per Step 5's step 7, with the same consent rule.

This is what makes the rise branch's *"re-selection is forced"* concrete: the
record is re-made against the risk picture now known to be right — and where the
repo grants authority, re-confirming is also what puts the change back under a
pipeline it has deliberately selected rather than the interim floor.

One signal worth surfacing: if the category **rose to `medium` or `high` at
`design`-end**, the design was conducted below the depth floor that category now
implies, which is worth saying out loud because it suggests the approach may have
been under-discussed. It does not retroactively re-run the design stage.

### Step 7 — Terminal write-back

When the change reaches `ship` finished (or is cancelled), ask the adapter to
write the outcome back to the ticket (`close` operation). Best-effort: a
failed tracker write is reported, never blocking.

On cancellation (`cancelChange`), also **delete `.defprod/change`** — a
cancelled change is no longer hands-on in the worktree. (On `ship`, the pin was
already cleared at the land hand-off, Step 6 / `change-land`.)

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
- **Risk is scored, never asserted.** Supply severity / occurrence / detection
  with per-axis evidence and let the server derive the category. Never send a
  category, and never try to patch `riskAssessment`, `confirmedPipeline` or
  `confirmedPipelineCategory` — `patchChange` refuses all three, deliberately: a
  patchable category would restore exactly the assertable category the derivation
  exists to remove. The confirmation fields have their own write path,
  `confirmChangePipeline`, which likewise derives rather than accepts the
  category; patch is still never it.
- **Never confirm a pipeline twice for the same selection.** Check whether
  `assessChangeRisk` already auto-confirmed the band before calling
  `confirmChangePipeline`. The change's history is an audit trail, and it should
  carry one entry per confirmation that actually changed.
- **Risk assessment never blocks the pipeline.** It is an activity within
  `accept`, not a stage — it moves no position and touches no stamps, and when
  the tool is unavailable (flag off, older server) the run simply continues
  without it. The same holds for every re-assessment.
- **Re-assess at the `design` and `code` boundaries, and ratchet one way.** A
  risen category forces the stricter pipeline and is announced; a fallen one is
  only ever *proposed* to a human, never applied, and is recorded-and-ignored
  under `--auto` / `--auto-all`. Raising oversight is safe to automate; lowering
  it is the thing the human was consulted about.
- **The server decides whether risk selects the pipeline; you read the answer.**
  Take the driver map from `getChange`'s `effectivePipeline` and report its
  `effectivePipelineSource`. Never infer authority from a repo setting, and never
  reshape a run around a category the server did not say was governing.
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

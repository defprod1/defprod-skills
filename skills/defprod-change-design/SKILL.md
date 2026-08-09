---
name: defprod-change-design
description: Design stage of the change workflow — explore the solution space for a change, settle the approach with the user, and record the design on the change record. Usually invoked by /defprod-change; works standalone too.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod__getChange
  - mcp__defprod__patchChange
  - mcp__defprod__startChangeStage
  - mcp__defprod__finishChangeStage
  - mcp__defprod__cancelChangeStage
---

> **Local extensions.** If a file named `SKILL.local.md` exists in this skill's
> directory, read it now and fold it into the steps below. It records this
> installation's local policies, additions, and overrides; where it conflicts
> with the instructions here, the local file takes precedence.
>
> **Then read `defprod-change/SKILL.local.md` too, if it exists**, and apply the
> parts that govern this stage. Installation policy for the *whole* pipeline is
> recorded with the orchestrator, because that is the skill that owns the
> pipeline — but this stage also runs standalone, and a stage that only read its
> own directory would silently skip policy the installation considers mandatory.
> That is a real failure mode, not a hypothetical: anything the setup binds to a
> change for its lifetime — a worktree or environment claimed for it, a database,
> a terminal session, an approval gate — is typically claimed and released by
> orchestrator-level policy, so a standalone stage that ignores it leaves the
> claim behind.

# Change Stage: Design

Produce the design for a change — the *how* behind the intent's *what & why* —
and record it on the change record.

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey, productSlug, multiProduct }`.
2. A branch named `chg/<slug>/CHG-NN-*` (or legacy `chg/CHG-NN-*`) → resolve via `getChange { productId, key }`.
3. A `Change: <product-slug>/CHG-NN` trailer on the HEAD commit → resolve the slug
   to a product, then `getChange { productId, key }` (tolerate a legacy bare
   `Change: CHG-NN` on older history, resolved with the pinned productId).

**A resolved carrier is a hint, not proof — validate it.** `getChange` the key
and confirm the change is live: if it is **shipped (frozen)** or **cancelled**,
the carrier is stale (a prior change left un-cleared). Disregard it — deleting a
stale `.defprod/change` file — and proceed as **no-context**. Only an *active*
change is a live context to stamp.

If a context resolves: call `startChangeStage { changeId, stage: 'design' }`
before beginning, and `finishChangeStage { changeId, stage: 'design' }` when
the design is agreed. If the work is abandoned mid-stage, call
`cancelChangeStage`. **If no context resolves, proceed silently** — stamping
only applies when a change record is attached.

## Execution mode (autonomous / interactive)

The orchestrator passes a **mode** derived from this stage's `driver`:
`agent` → `autonomous`, `human` → `interactive`. Invoked standalone with no
mode given, default to **interactive**.

- **autonomous** — settle the design yourself without asking: take the
  reasonable decision at each fork, record it, and `finishChangeStage`. There is
  no discussion — there is no human in the loop to have one with.
- **interactive** — design *with* the human: choose a discussion depth (Workflow
  step 2 below), and **always present the agreed design for explicit approval
  before `finishChangeStage`**.

## Workflow

1. **Ground in the intent.** Read the change's `intent` (and the codebase
   areas it touches). The design serves the intent — challenge scope creep.
2. **Explore the decision space.** Identify the genuine decisions (data model,
   API shape, UI placement, migration). For each: options, recommendation,
   trade-offs. In **autonomous** mode, resolve them yourself and move on. In
   **interactive** mode, **propose a discussion depth** (one line of reasoning)
   and let the user confirm or override:

   - **Quick-confirm** — small, unambiguous, one obvious approach: present the
     whole approach and ask for a single approval.
   - **Walk-the-decisions** — substantial but bounded: walk the genuine
     decisions one at a time (options → recommendation → trade-offs).
   - **Exhaustive design discussion** — large / high-ambiguity / many
     interdependent decisions / wide blast radius: hand off to the
     **`/defprod-exhaustive-discussion`** engine, which walks the decision tree
     in dependency order. **If that skill is not installed, fall back to
     walk-the-decisions** — never block on it.

   **Floors override the size guess.** If the change carries a **risk
   assessment** (`riskAssessment.category` on the record from `getChange`), that
   category sets the floor: **`medium` or `high` → never quick-confirm** (≥
   walk-the-decisions, biased toward exhaustive). Risk and depth are
   **orthogonal** — risk asks *how bad is it if this goes wrong*, depth asks *how
   ambiguous is the approach*. Adding an index to a billing collection is
   high-risk with nothing to discuss; a novel interaction pattern is low-risk with
   plenty. So the category sets only the **floor**; the tier above it stays the
   propose-confirm judgement above, and a `low` category does not cap the tier.

   If the change carries **no** assessment (older server, feature gated off, or a
   standalone invocation), fall back to the trigger list: a persisted data-model
   change, a migration, a billing / security / auth surface, or anything
   irreversible is *never* quick-confirm.

   Either way, the **cosmetic / global-rule-regression ceiling is unaffected by
   the category**: a purely cosmetic change or a global-rule regression floors at
   quick-confirm. When genuinely unsure in the middle, propose the **lighter**
   tier — escalation is one sentence away. **Escalate or de-escalate mid-stream**
   if the discussion reveals more (or less) than the proposed tier assumed.
3. **Settle it with the user.** The design stage ends with an *agreed* design,
   not a proposed one.
4. **Record it** on the change record (this skill records, whichever tier
   produced the design — the exhaustive engine stays change-agnostic and never
   touches the record itself):
   - Short, self-contained designs → `patchChange` writing the `design` field
     (markdown; include alternatives-considered).
   - Living/large design docs → write the doc in the repo and `patchChange`
     the `designDocPath` pointer instead. An exhaustive discussion's converged
     output usually belongs here.
   - If the recorded text mentions another change (a related change, a
     predecessor this design builds on or supersedes), render that mention per
     the *Change-key qualification* rule in `defprod-change/SKILL.md`
     (`multiProduct` from the resolved context above): qualified in a
     multi-product repo, bare in a single-product one.

## Rules

- Design is **skippable** — if the orchestrator or user deems the change too
  small to design, this skill is simply never invoked; do not invent ceremony.
- The recorded design is the *frozen decision*; ongoing evolution belongs in a
  living doc referenced by `designDocPath`.
- Delegation is one-way: `/defprod-exhaustive-discussion` produces a converged
  design + summary and stops; **this** skill records it and stamps the stage.
  Never expect the engine to know about change records or `finishChangeStage`.

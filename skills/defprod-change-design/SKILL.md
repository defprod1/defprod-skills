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

# Change Stage: Design

Produce the design for a change — the *how* behind the intent's *what & why* —
and record it on the change record.

## Change context (stamping preamble)

Resolve the current change context, in precedence order:
1. `.defprod/change` in the worktree root — JSON `{ productId, changeId, changeKey }`.
2. A branch named `chg/CHG-NN-*` → resolve via `getChange { productId, key }`.
3. A `Change: CHG-NN` trailer on the HEAD commit → same resolution.

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

   **Floors override the size guess:** a persisted data-model change, a
   migration, a billing / security / auth surface, or anything irreversible is
   *never* quick-confirm (≥ walk-the-decisions, biased toward exhaustive); a
   purely cosmetic change or a global-rule regression floors at quick-confirm.
   When genuinely unsure in the middle, propose the **lighter** tier — escalation
   is one sentence away. **Escalate or de-escalate mid-stream** if the discussion
   reveals more (or less) than the proposed tier assumed.
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

## Rules

- Design is **skippable** — if the orchestrator or user deems the change too
  small to design, this skill is simply never invoked; do not invent ceremony.
- The recorded design is the *frozen decision*; ongoing evolution belongs in a
  living doc referenced by `designDocPath`.
- Delegation is one-way: `/defprod-exhaustive-discussion` produces a converged
  design + summary and stops; **this** skill records it and stamps the stage.
  Never expect the engine to know about change records or `finishChangeStage`.

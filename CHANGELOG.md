# Changelog

All notable changes to `@defprod/skills` are documented here. The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — within reasonable judgement for a skills package where "breaking" usually means a slash-command rename.

The **source of truth for release notes is the [GitHub Releases](https://github.com/defprod1/defprod-skills/releases) page** for this repository. Each entry below mirrors a GitHub Release; click the version heading to read the full body, including any breaking-change upgrade guidance.

## [1.14.0] — 2026-07-29

### Changed

- **Change-key qualification now covers commit prose, PR text, and tracker write-backs — gated on repo cardinality.** Product-qualified change keys (`<product-slug>/CHG-NN`) previously covered only the commit trailer (v1.7.0) and the branch name (v1.13.0); every other human-readable rendering still fell back to a bare `CHG-NN`, which is ambiguous in a multi-product monorepo. `defprod-change/SKILL.md` now determines whether a repo hosts one product or several as part of its Step 1 resolution, states the qualification rule once, and persists it as `multiProduct` in the `.defprod/change` pin. `defprod-change-land` (commit subject/body, PR title/body), `defprod-change-tracker` (link/close write-backs), and `defprod-change-design` (recorded design text) all render qualified in a multi-product repo and bare in a single-product one. The commit trailer and branch name are unchanged — still unconditionally qualified whenever a product resolves, regardless of cardinality.

See [v1.14.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.14.0) for the full body.

## [1.13.0] — 2026-07-23

### Changed

- **Product-qualified change branches.** The change workflow now creates branches as `chg/<product-slug>/CHG-NN-<slug>`, so the branch tail matches the `Change: <slug>/CHG-NN` commit trailer and names its product at a glance in a multi-product monorepo. Every stage skill's context resolution accepts both the new nested form and the legacy `chg/CHG-NN-*`; the land-stage consistency guards were updated to match. Pairs with `@defprod/scripts` v1.4.0.

See [v1.13.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.13.0) for the full body.

## [1.12.0] — 2026-07-17

### Added

- **`defprod-onboard-product` guide-UI progress tracking.** New *Progress tracking* section patches `onboardingProgress.completedSteps` (the `ProductOnboardingStep` enum) after each phase, idempotently signalling workflow progress to the guide UI.
- Phase 4 now emits a full product-level **Validation Report** (four categorised discrepancy tables); Phase 5 gains a medium-depth architecture tree example and element-type list.

### Changed

- `defprod-onboard-product` Phase 1b honours partial-mapping include/exclude paths and follows shared libraries for context only; Phase 2 orders areas by importance (`order` field); brief persona/requirement field shapes corrected to match the Brief schema. (Merges the last monorepo-side fork of this skill into canonical.)

See [v1.12.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.12.0) for the full body.

## [1.11.1] — 2026-07-17

### Fixed

- `defprod-create-definition` now lists the required `positioning` field (market category, differentiation, competitive context) in the Phase 2 brief population step — it was previously omitted, leaving new definitions missing a required Brief field.

See [v1.11.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.11.1) for the full body.

## [1.11.0] — 2026-07-17

### Added

- **Per-run driver overrides for `/defprod-change`.** Steer who drives each pipeline stage for a single run without editing the product's pipeline config: `--auto` (skill-backed stages → `agent`), `--auto-all` (also auto-confirms intent + `accept` gate), `--interactive` (→ `human`), and fine-grained `<stage>=<driver>` pairs (combinable, explicit pairs win). The resolved overlay is echoed at run start, persisted in `.defprod/change` as `driverOverrides` (survives a CI/CD-handoff → resume), and re-applied each loop iteration — never written back to the product config. The `/defprod-implement-feature` and `/defprod-fix-bug` shims forward override args verbatim.

See [v1.11.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.11.0) for the full body.

## [1.10.0] — 2026-07-17

### Changed

- **Concurrency-safe change sessions.** The `.defprod/change` pin is now a lock: `defprod-change` refuses to claim a worktree already pinned to a different *active* change (override with `--force`), so two sessions can't silently share one tree. As a mid-stage backstop, `defprod-change-land` re-validates branch/pin consistency before committing and aborts on mismatch — preventing a commit from landing on the wrong branch when the tree drifts underneath a running stage.

See [v1.10.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.10.0) for the full body.

## [1.9.1] — 2026-07-16

### Fixed

- `defprod-untracked-change` Land step now cites `[skip ci]` instead of `[skip cd]`, matching the convention adopted across the toolchain. Documentation-only; no behavioural change.

See [v1.9.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.9.1) for the full body.

## [1.9.0] — 2026-07-05

### Added

- **Local skill customization via `SKILL.local.md`.** Every shipped `SKILL.md` now points to an optional `SKILL.local.md` companion in the same directory; the agent reads it and folds it in, with local content taking precedence on conflict. This lets you customize a skill **without editing (and freezing) the shipped file** — the shipped `SKILL.md` stays pristine and keeps receiving updates, while `SKILL.local.md` is never touched by `install`/`update` and never enters the lock. Both commands report which installed skills have one, and `verify` asserts every shipped skill carries the pointer. See the "Customizing a skill locally" section of the README.

See [v1.9.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.9.0) for the full body.

## [1.8.0] — 2026-07-04

### Changed

- `defprod-change-review` now reviews against a fuller, still repo-agnostic set of lenses — **correctness & regressions** (incl. silent behaviour changes for existing callers: return shape/nullability, breaking contract/response shapes), **error handling & resilience**, **security** (authz/access-scoping, multi-tenant isolation, input validation, secrets, injection), **test coverage** (report gaps as findings), **scope fidelity**, and **conventions & standards** (incl. type-safety escape hatches a typechecker won't flag). Context-gathering gains a **callers & tests** step and a **known-traps** prompt (consult a repo's own recurring-pitfalls docs). Findings now carry a **severity** (blocking / important / minor) and a `file:line` / what / why / fix shape, orthogonal to the existing confidence pass; the stage finishes when no blocking or important finding is unresolved. No new host-specific tooling — the skill stays self-sufficient and portable.

See [v1.8.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.8.0) for the full body.

## [1.7.0] — 2026-07-03

### Added

- Product-scoped change selection for monorepos. `defprod-change` resolves the target product via the repo↔product linkage (`.defprod/defprod.json` `repoId` → products by `repoId` → `repoPackagePath` → changed-files' route/area → ask), keeping a single `productId` as the single-product fast path.

### Changed

- `defprod-change-land` writes the product-scoped commit trailer `Change: <product-slug>/CHG-NN` (was `Change: CHG-NN`); the `.defprod/change` pin now carries `productSlug`. All stage skills still tolerate the legacy bare `Change: CHG-NN` on existing history. Requires `@defprod/scripts` ≥ 1.3.0 to resolve the slug in CI. Builds on DefProd CORE-42.

See [v1.7.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.7.0) for the full body.

## [1.6.1] — 2026-06-16

### Changed

- `defprod-change-review` is now self-sufficient and agent-portable: removed the deference to a host-specific review command (e.g. `/code-review`) as its primary path, so the same review runs on any host. Added a context-gathering step (repo rules + git history/blame) and a single-pass confidence-scoring step (score each finding 0–100, discard below 80) to ground findings and cut false positives.

See [v1.6.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.6.1) for the full body.

## [1.6.0] — 2026-06-14

### Added

- `defprod-untracked-change` — the front door for *recordless* work (ADR0004): quality-gated (code/test/review/land, reusing the stage skills context-free) but with no change record, no stamping, and no `Change:` trailer. Escalates to `defprod-change` the moment a design decision, a definition change, or a trackable decision appears.

### Changed

- `defprod-change-land` honours the stage's pipeline `driver` for merge/push consent: an `agent`/`autonomous` stage proceeds without prompting (the driver config is the standing consent); a `human`/`interactive` stage confirms first. Replaces the blanket consent prompt that overrode the `agent` driver.

### Fixed

- The `.defprod/change` change-context carrier is now self-healing: every stage skill validates a resolved carrier and treats a shipped/cancelled pin as no-context (deleting it); `defprod-change-land` clears the pin at hand-off; the orchestrator clears it on cancel and overwrites a stale pin. Stale pins no longer trip later runs.

See [v1.6.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.6.0) for the full body.

## [1.5.0] — 2026-06-13

### Added

- `defprod-exhaustive-discussion` — a structured, high-rigor design review that walks each branch of a design decision tree in dependency order. The `defprod-change-design` stage escalates to it for large or ambiguous changes.

### Changed

- All change stage skills (`design`, `define`, `code`, `test`, `review`, `land`) gain an explicit `autonomous` / `interactive` execution mode derived from the stage's pipeline driver.
- `defprod-change-land` stamps the `merge`/`push` stage start before the operation and finish after it succeeds (both sides), superseding the finish-only shortcut.

See [v1.5.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.5.0) for the full body.

## [1.4.0] — 2026-06-13

### Added

- The change workflow: `defprod-change` (end-to-end orchestrator with driver-gated stage loop), six self-stamping stage skills (`defprod-change-design/define/code/test/review/land`), and the user-owned `defprod-change-tracker` adapter template (fetch/link/close; installer never overwrites local edits). Requires a DefProd server with change records (Lifecycle v2).
- `defprod-realize-product-from-template` — realize a new product from a DefProd template end-to-end: copy the template's definition, scaffold a working codebase from the template's linked starter Git repo (running its `bootstrapCommand`), onboard and link the new repo, and verify it builds. Degrades to a definition-only copy when the template has no starter repo bound.

### Changed

- `defprod-implement-feature` and `defprod-fix-bug` are now thin shims that invoke `/defprod-change` with the type preset; their former phase content lives in the stage skills.

See [v1.4.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.4.0) for the full body.

## [1.3.1] — 2026-05-26

### Added

- Installer auto-prunes retired skill directories on `update`. Uses an explicit `retired-skills.json` list (never wildcard); pristine-check matches each file's hash against `known-shipped.json` before deleting. Locally-modified retired skills are kept and reported.
- `install` now warns if retired skill directories are present locally (no deletion at install time).
- `CHANGELOG.md` ships in the npm tarball; README links to it.

### Changed

- `npx @defprod/skills update` output gains a `pruned <N>` count and a separate "retired skills" section.

See [v1.3.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.3.1) for the full body.

## [1.3.0] — 2026-05-26

### Added

- New `defprod-create-area-tests` dispatcher skill — surface-aware: walks every story in an area, groups by `surface` (explicit or inferred), and invokes the matching per-surface sibling for each group.
- Granularity contract and decomposition pass in `defprod-create-area-stories` (Phase 2c variant matrix, Phase 2d decomposition for Add-more mode, Phase 3.0 contract, coarse-title / matrix-row-uncovered lint).

### Changed

- The four per-surface test-creation skills now filter their area's stories by effective `UserStory.surface` (explicit value, or inferred from story-key prefix per [CORE-38](https://github.com/defprod1/defprod/commit/436813bb)). Each skill tags inference-routed stories in its Phase 5c coverage summary so users can decide whether to backfill `surface`.
- Coverage summaries gain a `Surface` column and an "Out-of-scope stories" section so skipped surfaces are visible, not silent.

### Renamed (breaking — see [v1.3.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.3.0) for upgrade guidance)

- `defprod-create-area-tests` *(Playwright e2e)* → `defprod-create-ui-tests`. The old name is reused for the new dispatcher.
- `defprod-create-api-area-tests` → `defprod-create-api-tests`
- `defprod-create-mcp-area-tests` → `defprod-create-mcp-tests`
- `defprod-create-cli-area-tests` → `defprod-create-cli-tests`

## [1.2.5] — 2026-05-15

See [v1.2.5 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.5).

## [1.2.4] — 2026-04-22

See [v1.2.4 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.4) (auto-generated).

## [1.2.3] — 2026-04-22

See [v1.2.3 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.3) (auto-generated).

## [1.2.2] — 2026-04-22

See [v1.2.2 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.2) (auto-generated).

## [1.2.1] — 2026-04-17

See [v1.2.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.1) (auto-generated).

## [1.2.0] — 2026-04-12

See [v1.2.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.2.0) (auto-generated).

## [1.1.1] — 2026-04-12

See [v1.1.1 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.1.1) (auto-generated).

## [1.1.0] — 2026-04-05

See [v1.1.0 release notes](https://github.com/defprod1/defprod-skills/releases/tag/v1.1.0) (auto-generated).

## [1.0.0] — 2026-04-05

Initial public release.

[1.14.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.14.0
[1.12.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.12.0
[1.11.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.11.1
[1.11.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.11.0
[1.10.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.10.0
[1.9.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.9.1
[1.9.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.9.0
[1.8.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.8.0
[1.7.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.7.0
[1.6.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.6.1
[1.6.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.6.0
[1.5.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.5.0
[1.4.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.4.0
[1.3.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.3.1
[1.3.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.3.0
[1.2.5]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.5
[1.2.4]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.4
[1.2.3]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.3
[1.2.2]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.2
[1.2.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.1
[1.2.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.2.0
[1.1.1]: https://github.com/defprod1/defprod-skills/releases/tag/v1.1.1
[1.1.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.1.0
[1.0.0]: https://github.com/defprod1/defprod-skills/releases/tag/v1.0.0

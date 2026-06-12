# Changelog

All notable changes to `@defprod/skills` are documented here. The format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — within reasonable judgement for a skills package where "breaking" usually means a slash-command rename.

The **source of truth for release notes is the [GitHub Releases](https://github.com/defprod1/defprod-skills/releases) page** for this repository. Each entry below mirrors a GitHub Release; click the version heading to read the full body, including any breaking-change upgrade guidance.

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

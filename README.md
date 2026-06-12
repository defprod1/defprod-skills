# @defprod/skills

Agent skills for [DefProd](https://defprod.com) — structured product definitions that AI agents can read, write, and reason about. These skills encode DefProd's opinionated workflows: user story alignment before code, acceptance criteria that drive tests, drift detection between definition and implementation.

**Release notes:** [GitHub Releases](https://github.com/defprod1/defprod-skills/releases) (source of truth) · [`CHANGELOG.md`](./CHANGELOG.md) (mirrors the same content, ships with the package).

## Compatibility

These skills work with any AI coding tool that discovers skills from `.claude/skills/` in your repository:

- **[Claude Code](https://claude.ai/claude-code)** — CLI, desktop, web, and IDE extensions. Skills appear in the `/` menu and are suggested automatically based on context. The `allowed-tools` frontmatter field is consumed by Claude Code to grant tool permissions.
- **[Cursor](https://cursor.com)** — reads `.claude/skills/` and presents skills as available actions. Cursor ignores the `allowed-tools` frontmatter field (it uses its own rules system).
- **[OpenCode](https://github.com/opencode-ai/opencode)** — discovers `.claude/skills/` and executes skills via its agent loop. OpenCode ignores unknown frontmatter fields.

All three tools read SKILL.md files from the same `.claude/skills/` directory, which is the default install location for the `@defprod/skills` installer. Skill body text uses logical MCP tool names (e.g. "call `listAreas` from the `defprod` MCP server") so the agent in any tool can resolve them correctly. Platform-specific `mcp__` prefixed names appear only in the `allowed-tools` frontmatter.

To install skills to a different directory, use `--skills-dir` or set `skillsDir` in `.defprod/defprod.json` — see [Configuration](#configuration).

## Prerequisites

- An AI coding agent that supports `.claude/skills/` — [Claude Code](https://claude.ai/claude-code), [Cursor](https://cursor.com), or [OpenCode](https://github.com/opencode-ai/opencode)
- A [DefProd](https://defprod.com) account with at least one product
- The DefProd MCP server connected to your agent ([setup guide](https://defprod.com/docs/mcp))

## Install

```bash
npx @defprod/skills install
```

This copies official skills into `.claude/skills/defprod-*/` in your current directory. Commit them to your repo — they're part of your project, like `.eslintrc`. See [Community Skills](#community-skills) to install community-contributed skills as well.

## Update

```bash
npx @defprod/skills update
```

Pulls new versions of all installed skills — both official and community — without overwriting files you've modified locally. To accept an updated version of a file you've changed, delete your copy and run update again.

### Auto-prune of retired skills

When an official skill is renamed or removed across versions, its old directory name is added to a small explicit list (`retired-skills.json` in the package). On `update`, the installer checks the user's skills directory for any of those names and:

- If a retired directory exists locally **and every file in it matches a hash this package previously shipped under that name**, the directory is deleted with a one-line `prune` log entry.
- If any file has been locally modified, the directory is **kept** and reported so you can copy out your changes before removing it manually.

The list is **explicit** (specific names), never a wildcard like `defprod-*` — so a user-created skill that happens to share the prefix is never touched. The pristine check uses the same hash manifest (`known-shipped.json`) that protects modified files from being overwritten elsewhere in `update`.

## Uninstall

To remove a skill, delete its directory:

```bash
rm -rf .claude/skills/defprod-onboard-repo
```

There's no uninstall command — skills are just directories with markdown files.

## Getting started

After installing, follow these steps to go from zero to a fully onboarded repository:

1. **Scan your repo** — run `/defprod-onboard-repo` in the repository root. It discovers your apps and libraries, proposes which should become DefProd products, and writes an onboarding document.

2. **Define each product** — run `/defprod-onboard-product <product-name>` for each product. It builds the brief, areas, and user stories by analysing your codebase. This is where the definition takes shape.

3. **Start building with definition sync** — your products are now defined. Use these skills in your daily workflow:
   - `/defprod-implement-feature` — aligns every code change to a user story before you write it
   - `/defprod-fix-bug` — traces bugs back to acceptance criteria and verifies the fix against them
   - `/defprod-create-area-tests` — surface-aware dispatcher that generates the right tests for every story in an area (UI, API, MCP, CLI)
   - `/defprod-analyze-discrepancies` — catches drift between your definition and your code

## Official Skills

Authored and maintained by the DefProd team.

| Skill | Purpose | Stage |
|-------|---------|-------|
| `defprod-onboard-repo` | Discover repo structure, propose product-to-package mapping | Onboarding |
| `defprod-onboard-product` | Iteratively define product: brief, areas, stories, validation, architecture | Onboarding |
| `defprod-realize-product-from-template` | Create a product from a template and scaffold its codebase from the template's linked starter Git repo | Onboarding |
| `defprod-create-definition` | Populate brief + areas from codebase analysis | Onboarding |
| `defprod-create-area-stories` | Create user stories with acceptance criteria from codebase | Definition |
| `defprod-implement-feature` | User story alignment, implementation, verification workflow | Development |
| `defprod-implement-product` | Scaffold project and implement product definition area-by-area | Development |
| `defprod-fix-bug` | Trace bug to user story, fix, verify against acceptance criteria | Development |
| `defprod-create-area-tests` | Surface-aware dispatcher — groups stories by `surface` and routes to the per-surface sibling skills | Testing |
| `defprod-create-ui-tests` | Generate Playwright e2e tests for stories whose surface is `ui` | Testing |
| `defprod-create-api-tests` | Generate Vitest/Jest HTTP integration tests for stories whose surface is `api` | Testing |
| `defprod-create-mcp-tests` | Generate Vitest integration tests for stories whose surface is `mcp` (via @modelcontextprotocol/sdk) | Testing |
| `defprod-create-cli-tests` | Generate Jest subprocess tests for stories whose surface is `cli` | Testing |
| `defprod-run-area-tests` | Run area tests, classify failures as test vs production fault | Testing |
| `defprod-fix-test-failures` | Read test report, implement fixes | Testing |
| `defprod-sync-story-test-status` | Run all configured suites and post per-story pass/fail to the DefProd test-status dashboard | Testing |
| `defprod-analyze-discrepancies` | Find drift between product definition and code | Maintenance |
| `defprod-fix-discrepancies` | Act on discrepancy report — update definition + code | Maintenance |

## Community Skills

Community-contributed skills live in the `contrib/` directory. These are submitted by DefProd users and reviewed by the DefProd team for quality, but maintained by their original authors.

To see available community skills:

```bash
npx @defprod/skills contrib
```

To install one or more community skills alongside the official set:

```bash
npx @defprod/skills install --contrib defprod-django-tests --contrib defprod-rust-coverage
```

Community skills are installed into `.claude/skills/` alongside official skills. They follow the same naming convention (`defprod-*`) and the same SKILL.md format.

### Contributing a skill

We welcome community skills that extend DefProd's workflows into new frameworks, languages, or use cases. To submit a skill:

1. Fork this repo
2. Copy `contrib/TEMPLATE/` to `contrib/defprod-<your-skill-name>/`
3. Replace every `{{placeholder}}` in `SKILL.md` with your content — search for `{{` to find them all. HTML comments (`<!-- ... -->`) explain what each section expects.
4. Remove all `<!-- ... -->` comments — they're scaffolding, not part of the finished skill.
5. Run `node scripts/verify-skills.js` to check your skill passes validation
6. Open a pull request with a description of what the skill does and when to use it

**Guidelines:**
- Skills must use the `defprod-` prefix
- Keep skills focused — one skill, one workflow
- Document which `.defprod/defprod.json` config keys your skill consults (if any)
- Include a "When to use" section so the agent knows when to suggest the skill

The DefProd team reviews community PRs for quality and clarity. We may suggest changes but won't rewrite your skill — you maintain it.

## Configuration

Skills work without any configuration — they discover project paths automatically. For faster, more deterministic results, create `.defprod/defprod.json`:

```json
{
  "skillsDir": ".claude/skills",
  "products": [
    {
      "name": "Customer Portal",
      "frontendApp": "apps/customer-portal",
      "backendApp": "apps/customer-api",
      "e2eDir": "apps/customer-portal/e2e",
      "compileCheck": "nx build customer-portal"
    },
    {
      "name": "Admin Dashboard",
      "frontendApp": "apps/admin",
      "backendApp": "apps/admin-api"
    }
  ]
}
```

Each entry in `products` maps to a DefProd product. Skills match by `name` against the product name in DefProd. All keys are optional — add them as needed. For single-product repos, use one entry.

| Key | Type | Purpose |
|-----|------|---------|
| `skillsDir` | `string` | Directory where skills are installed (default: `.claude/skills`). The `--skills-dir` CLI flag takes precedence over this. |
| `products` | `array` | List of product configurations |
| `products[].name` | `string` | Product name — must match the DefProd product name |
| `products[].frontendApp` | `string` | Path to the frontend app |
| `products[].backendApp` | `string` | Path to the backend app |
| `products[].mcpApp` | `string` | Path to the MCP server app (used by `defprod-create-mcp-tests`) |
| `products[].cliApp` | `string` | Path to the CLI app (used by `defprod-create-cli-tests`) |
| `products[].e2eDir` | `string` | Path to the e2e test directory |
| `products[].apiTestDir` | `string` | Path to the API integration test directory (default `<backendApp>/tests/areas`) |
| `products[].mcpTestDir` | `string` | Path to the MCP integration test directory (default `<mcpApp>/tests/areas`) |
| `products[].cliTestDir` | `string` | Path to the CLI integration test directory (default `<cliApp>/tests/areas`) |
| `products[].apiBaseUrl` | `string` | Base URL for API integration tests |
| `products[].mcpBaseUrl` | `string` | Base URL for the MCP server during integration tests |
| `products[].cliBinaryPath` | `string` | Built CLI binary path (default `dist/<cliApp>/main.js`) |
| `products[].compileCheck` | `string` | Command to verify compilation |

## Structure of a DefProd skill

DefProd skills follow a consistent pattern:

1. **Check config** — read `.defprod/defprod.json` for instant path resolution
2. **Discover** — if config doesn't have what's needed, explore the codebase
3. **Confirm** — present findings to the user before taking action
4. **Act** — create definitions, generate tests, or fix drift via the DefProd MCP server

Skills communicate with DefProd through the DefProd MCP server. They read and write product definitions — briefs, product areas, user stories, acceptance criteria, architecture — using MCP tools like `listAreas`, `listUserStories`, `patchUserStory`, etc.

## License

MIT

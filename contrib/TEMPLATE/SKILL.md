---
name: defprod-{{skill-name}}
description: {{One-line description — shown in the agent's skill list and used by the installer.}}
allowed-tools:                              # Used by Claude Code for tool permissions — other agents ignore this field
  - Read
  - Glob
  - Grep
  - Bash(ls:*)
  - Write
  - Edit
  - AskUserQuestion
  - mcp__defprod-mcp__listProducts          # Use mcp__<server>__<tool> format in frontmatter only.
  - mcp__defprod-mcp__listAreas             # In the skill body, use logical names (e.g. "call listAreas")
  - mcp__defprod-mcp__listUserStories       # so the skill works across all compatible agents.
---

# {{Skill Title}}

{{1-2 sentence summary of what this skill does and the outcome it produces.}}

## When to use

- {{Trigger scenario — when should a user or agent invoke this skill?}}
- When invoked via `/defprod-{{skill-name}}`.

## Config

This skill consults `.defprod/defprod.json` for optional hints. If the file doesn't exist, the skill discovers everything automatically.

<!-- List only the config keys your skill actually uses. Remove this section if your skill uses none. -->

| Key | Type | Purpose |
|-----|------|---------|
| `products[].{{configKey}}` | `string` | {{What this config key provides to your skill}} |

---

## Workflow

<!-- Break your skill into numbered phases. Each phase should have a clear purpose and outcome. -->

### Phase 1 — Discovery

<!-- What does the skill need to know before it can act? Read files, call MCP, ask the user? -->

1. Read `.defprod/defprod.json` if it exists for project-specific paths.
2. Call `listAreas` and `listUserStories` via the DefProd MCP server to get the product definition context.
3. {{Your discovery steps here.}}

<!--
  Add as many phases as your skill needs between Discovery and Summary.
  Common patterns from official skills:
  - A confirmation gate: present findings to the user and wait for approval before acting
  - An action phase: create files, call MCP, modify code
  - An analysis phase: compare definition against codebase
  Not every skill needs a confirmation gate — use one when the skill writes files,
  modifies the product definition, or makes decisions the user should review first.
-->

### Phase 2 — {{Phase Name}}

{{What this phase does — its purpose, steps, and outcome.}}

### Phase 3 — {{Phase Name}}

{{What this phase does — its purpose, steps, and outcome.}}

### Phase 4 — Summary

{{Present a summary of what was done and suggest next steps.}}

---

## Rules

<!-- Constraints the LLM must follow when executing this skill. -->

- {{Your skill-specific rule — add as many rules as needed, or remove this section if there are none. Consider whether your skill should require user confirmation before writing files or modifying the product definition.}}

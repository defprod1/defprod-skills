---
name: defprod-change-tracker
description: USER-OWNED adapter — how this team's external tracker (JIRA, Notion, Linear, a docs repo, …) is read and written by the change workflow. Fill in the three operations below for your tracker; /defprod-change invokes this skill for ticket fetch, promotion link write-back, and terminal close write-back.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - WebFetch
---

# Change Tracker Adapter (fill me in)

`/defprod-change` is tracker-agnostic. This skill is the seam: it defines the
**three operations** the change workflow needs from your tracker, and **you
edit this file** to say how each is done for your team. The worked examples
below cover common setups — replace the "Your tracker" sections with real
instructions and delete the examples you don't use.

> **This file is user-owned.** The skills installer never overwrites a
> locally-modified copy of this skill on update.

## The three operations

### 1. `fetch(ref)` — read an accepted ticket

Given a ticket reference or URL, obtain: **title**, **url**, and the material
needed to distill an **intent** (what & why). Also report whether the ticket
already carries a DefProd change link (for dedupe).

**Your tracker:** _describe how to fetch a ticket here._

### 2. `link(ref, changeKey)` — mark the ticket promoted

Record the DefProd change key (e.g. `CHG-07`) on the ticket so a second
promotion attempt is caught at fetch time.

**Your tracker:** _describe how to write the link here._

### 3. `close(ref, outcome)` — terminal write-back

When the change ships or is cancelled, write the outcome back (e.g. a comment
"Shipped as CHG-07" or a status flip).

**Your tracker:** _describe how to close out the ticket here._

---

## Worked examples

### Example A — markdown intents repo (a "team brain")

A git repo of intent files like `intents/INT0007-bulk-export.md` with
frontmatter including `status:` and `link:` fields.

- **fetch**: `Read` the intent file by ref (e.g. `INT0007` →
  `~/team-brain/intents/INT0007-*.md`). Title = H1; intent material = body.
  Already-promoted check: frontmatter `link:` is non-empty.
- **link**: set frontmatter `link: CHG-NN` and `status: promoted`; commit.
- **close**: set `status: done` (or `dropped`), append an outcome line; commit.

### Example B — JIRA via an MCP connector

Assumes a JIRA/Atlassian MCP server is connected.

- **fetch**: get the issue by key; title = summary, url = browse link, intent
  material = description + recent comments. Already-promoted check: look for a
  `DefProd: CHG-NN` label or comment.
- **link**: add a comment `Promoted to DefProd as CHG-NN` (or set a custom
  field / label if your project has one).
- **close**: add a comment `Shipped as CHG-NN` / `Cancelled (CHG-NN)`; or
  transition the issue per your team's workflow.

### Example C — Notion via an MCP connector

- **fetch**: read the page by URL/id; title = page title, intent material =
  page content. Already-promoted check: a `DefProd change` property.
- **link**: set the `DefProd change` property to `CHG-NN`.
- **close**: set the page status property and append an outcome block.

---

## Rules

- All tracker writes are **best-effort**: report failures, never block the
  change workflow on them.
- Never store tracker credentials in this file — rely on connectors (MCP
  servers, CLIs) already configured in the environment.
- DefProd is the source of truth between `link` and `close` — do not add
  per-stage status mirroring here.

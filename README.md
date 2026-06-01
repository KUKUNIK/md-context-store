# md-context-store

[![CI](https://github.com/KUKUNIK/md-context-store/actions/workflows/ci.yml/badge.svg)](https://github.com/KUKUNIK/md-context-store/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/md-context-store.svg)](https://www.npmjs.com/package/md-context-store)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

A local, filesystem-based context store for AI agent sessions. Plain markdown files with YAML frontmatter — no database, no server, no lock-in.

If you've ever pasted "here's what I was doing last time" into a Claude/GPT/Codex session over and over, this gives you a CLI to dump that context once and reload it cleanly.

> Status: `0.1.0` — usable, but the schema may evolve before `1.0`.

## Why

Modern AI coding assistants don't have a persistent memory of your project. Most workflows end up with one of:

- A wall of text pasted at the start of every session (lossy, drifts).
- A vendor-specific memory store (locked in, opaque, harder to inspect).
- A homemade SQLite/Postgres "memory" with custom MCP tooling (powerful, but heavy and per-host).

`md-context-store` picks the boring middle path: **a directory of markdown files**, organized per project, with three entry kinds (`chunk`, `decision`, `issue`) plus two singletons (`project summary`, `current work`). A single CLI command produces a clean markdown "bootstrap" you can paste into any agent.

It's optimized for the case where you, the developer, are the source of truth — not the agent.

## Install

```bash
npm install -g md-context-store
# or
pnpm add -g md-context-store
```

Requires Node 18+.

## Quick start

```bash
# create a project
mdcs init my-app --summary "A small Next.js side project"

# add some context
mdcs add chunk my-app --section "stack" --body "Next.js 16, Tailwind v4, Drizzle on SQLite"
mdcs add decision my-app --title "Use SQLite for v0" --by "dohyun" \
  --reasoning "Single-user app, no concurrent writers — Postgres is overkill."
mdcs add issue my-app --title "Auth redirect loops on /dashboard" --type bug --severity high

# track what you're doing right now
mdcs current my-app --content "$(cat <<'EOF'
phase: building auth
status: in_progress
next: hook up middleware redirect
EOF
)"

# dump everything as one markdown blob
mdcs bootstrap my-app > bootstrap.md
```

`bootstrap.md` is the thing you paste into your next AI session.

## Storage layout

Everything lives under `$MDCS_HOME` (default: `~/.mdcs/`):

```
~/.mdcs/
  projects/
    my-app/
      project.md            # identity / scope (singleton)
      current.md            # current work snapshot (singleton)
      chunks/
        20260601-103200-001-stack.md
        20260601-110045-022-routing-decision.md
      decisions/
        20260601-111530-008-use-sqlite-for-v0.md
      issues/
        20260601-120200-014-auth-redirect-loops.md
```

Every entry is one markdown file with a YAML frontmatter block. Open in any editor, diff with git, back up by copying the directory. That's the whole storage model.

## CLI reference

```
mdcs init <project-id> [--summary <text>]

mdcs projects
mdcs summary <project-id> [--content <text> | --content-file <path> | --stdin]
mdcs current <project-id> [--content <text> | --content-file <path> | --stdin]

mdcs add chunk <project-id> --section <name> [--body | --body-file | --stdin] [--by <agent>]
mdcs add decision <project-id> --title <text> --by <agent>
  [--reasoning <text>] [--body | --body-file | --stdin] [--date <yyyy-mm-dd>]
mdcs add issue <project-id> --title <text> --type bug|task|risk|incident
  [--severity low|medium|high|critical] [--body | --body-file | --stdin] [--by <agent>]

mdcs list <project-id> <kind> [--limit <n>] [--archived] [--status <state>]
mdcs show <project-id> <kind> <id>

mdcs status <project-id> <issue-id> open|in_progress|resolved|archived
mdcs archive <project-id> <kind> <id> --reason <text>
mdcs restore <project-id> <kind> <id>

mdcs bootstrap <project-id> [--limit-chunks <n>] [--limit-decisions <n>] [--limit-issues <n>]

# global option for any command:
  --store <path>          # override store root (default $MDCS_HOME or ~/.mdcs)
```

## Library usage

```ts
import { Store, buildBootstrap, renderBootstrap } from "md-context-store";

const store = new Store({ root: "./my-store" });
await store.initProject("demo");

await store.addChunk("demo", {
  section: "stack",
  body: "Next.js 16, Tailwind v4",
});

const result = await buildBootstrap(store, "demo", {
  recentChunkLimit: 5,
  recentDecisionLimit: 5,
  openIssueLimit: 20,
});

console.log(renderBootstrap(result));
```

The `Entry`, `BootstrapResult`, and frontmatter types are exported, so you can build your own renderers (HTML, JSON, prompt templates) on top.

## Design choices

- **Filesystem over database.** Diffable, greppable, backupable. The cost is no concurrent writers — fine for a single dev's notes.
- **Three entry kinds.** `chunk` (free-form context), `decision` (a choice + reasoning), `issue` (a tracked task/bug/risk). Anything that doesn't fit cleanly goes in `chunk`.
- **Two singletons per project.** `project.md` is identity ("what is this project") and rarely changes. `current.md` is your live work pointer and changes constantly.
- **Soft archive, never hard delete.** Archived entries stay on disk with `archived: true`. You can grep history later.
- **No magic IDs.** Entry IDs are `YYYYMMDD-HHMMSS-mmm-<slug>` — sortable by time, readable by humans.
- **Author tracking.** The `by` / `decided_by` frontmatter field lets you mark whether something was written by you, by Claude, by GPT, etc. — useful when an agent is summarizing on your behalf.

## What it's not

- Not a project management tool. There's no kanban, no assignees, no due dates.
- Not multi-user. Two people writing to the same store will clobber each other.
- Not a knowledge base for end users. It's a back-channel for you and your AI session.

## Roadmap

- [ ] `mdcs handoff` — render a session handoff package for a different agent.
- [ ] Search across chunks (companion package: `md-chunk-search`).
- [ ] Git integration helpers (commit on every write, optional).
- [ ] Subproject hierarchy (one level deep).

## Development

```bash
pnpm install
pnpm test          # vitest
pnpm typecheck     # tsc --noEmit
pnpm build         # tsup
```

## License

MIT

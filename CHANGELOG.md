# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `mdcs list <project-id> <kind> --since <yyyy-mm-dd-or-iso>` filters
  entries by an inclusive lower bound on `created_at`. ListOptions
  gains a matching `since` field for library callers.
- `SECURITY.md` describing the reporting flow and the (intentionally
  narrow) attack surface — local filesystem, optional `--git` audit
  commits, no network.

## [0.2.0] - 2026-06-03

### Added

- **Git audit trail.** `--git` makes every store write — summary,
  current work, new chunks/decisions/issues, status transitions,
  archive / restore — into a single git commit on the store root.
  Commit subjects name the operation and the affected entry id.
- `mdcs --git log` reads the audit trail (sha · ISO date · subject).
- `--git-author` and `--git-email` override the committer identity
  (defaults: `mdcs / mdcs@local`).
- Library: `GitAudit` class + `GitOptions` / `GitAuditOptions` types
  exported from the package root. `Store` accepts a `git` field in
  `StoreConfig`; opt-in only — omit it and behavior is identical to
  `0.1.0`.
- `Store.gitEnabled` getter and `Store.auditLog(limit?)` helper.

### Notes

- The first commit runs `git init --initial-branch=main` if the store
  root isn't already a repo; pass `initIfMissing: false` to require
  an existing repo.
- Commits use `--no-verify` so user hooks don't fire on mdcs writes.

## [0.1.0] - 2026-06-01

### Added

- Initial release.
- `Store` class with `initProject`, `addChunk`, `addDecision`, `addIssue`, list / show / archive / restore methods.
- Project summary (`project.md`) and current-work summary (`current.md`) singletons per project.
- `mdcs` CLI: `init`, `projects`, `summary`, `current`, `add chunk|decision|issue`, `list`, `show`, `status`, `archive`, `restore`, `bootstrap`.
- Soft-archive semantics (entries are flagged `archived: true`, never hard-deleted).
- Bootstrap renderer that combines project summary, current work, recent chunks/decisions, and open issues into a single markdown payload.
- TypeScript types exported from the package root (`Entry`, `BootstrapResult`, frontmatter shapes).

### Schema notes

- Entry IDs use `YYYYMMDD-HHMMSS-mmm-<slug>` for sortable, human-readable filenames.
- Frontmatter is parsed with `gray-matter`; bodies are plain markdown.

# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

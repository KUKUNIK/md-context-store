# Contributing

Thanks for considering a contribution.

## Setup

```bash
git clone https://github.com/KUKUNIK/md-context-store
cd md-context-store
npm install
npm test
```

## Development loop

```bash
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run build         # tsup
```

CI runs typecheck → test → build on Node 18, 20, and 22. Match that locally before opening a PR.

## What we welcome

- Bug fixes (with a failing test that reproduces the bug).
- New CLI flags or library functions, *if* they fit the storage model (one project = one directory; entries are markdown files with YAML frontmatter).
- Documentation improvements — especially clearer examples.

## What we are cautious about

- Breaking changes to the directory layout (`projects/<id>/chunks`, `decisions`, `issues`). Files written by an earlier version need to keep working.
- New entry kinds beyond `chunk` / `decision` / `issue`. The three-kind model is a deliberate constraint; expanding it dilutes the "boring middle path" the project picked.
- New dependencies. The package is intentionally small.

## Process

1. Open an issue describing the change before sending a PR for anything non-trivial.
2. Keep PRs focused — one fix or one feature per PR.
3. Update the README if you change CLI behavior.
4. The CI must be green.

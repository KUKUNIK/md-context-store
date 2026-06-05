# Security Policy

## Scope

`md-context-store` is a local-filesystem tool. It does not open network
sockets, ship telemetry, or call third-party APIs. The primary security
surface is therefore:

- **What it writes to disk** — store entries are markdown files under
  `$MDCS_HOME` (default: `~/.mdcs/`). They are written with the
  invoking user's umask; the package does not chmod files beyond that.
- **What it writes to git** — the optional `--git` mode commits every
  store mutation to the store root as an audit trail. Author / email
  default to `mdcs / mdcs@local` unless overridden.

This tool stores whatever you put in it. If you `mdcs add chunk` a
secret, the secret lives on disk in plaintext (and, with `--git`,
inside git history). Don't do that.

## Supported versions

The latest minor release on the `main` branch receives security fixes.
There are no LTS branches.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** rather than
opening a public GitHub issue.

1. Open a draft GitHub Security Advisory on this repository
   (`Security` tab → `Report a vulnerability`). This keeps the report
   private until a fix is ready.
2. If you cannot use the advisory flow, email the maintainer listed in
   the GitHub profile of `KUKUNIK`.

Please include:

- a minimal reproducer
- the package version (`npm ls md-context-store` or the local commit
  sha)
- the impact you observed (file disclosure, write outside store root,
  command injection, etc.)

We aim to acknowledge reports within 7 days. Coordinated disclosure
timelines are negotiated case-by-case but default to a 90-day cap
from acknowledgment.

## Out of scope

- Issues that require an attacker to already have write access to
  `$MDCS_HOME`. Anyone with that access already controls the store.
- The default `mdcs / mdcs@local` git identity. It is intentionally
  generic; override with `--git-author` / `--git-email` if you want
  attribution.
- Unsupported Node.js versions (the package targets `>=18` per
  `package.json` `engines`).

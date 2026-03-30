# CLAUDE.md

This file provides context and conventions for AI assistants (e.g., Claude Code) working in this repository.

## Repository Overview

**Name:** firstTest
**Purpose:** Test repository — currently a minimal scaffold.
**Remote:** `youngjaeseo-git/firsttest` on GitHub

The repository contains only a `README.md` at this stage. As development grows, this file should be updated to reflect the evolving structure.

## Repository Structure

```
firstTest/
├── README.md       # Project description
└── CLAUDE.md       # This file
```

## Branch Conventions

| Branch pattern | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `claude/<description>` | AI-assisted feature or documentation branches |

Always develop on a feature branch and push before opening a pull request. Never push directly to `main` without explicit permission.

## Git Workflow

1. Check out or create the appropriate feature branch.
2. Make changes, then stage specific files (avoid `git add -A` to prevent accidental inclusion of secrets or large files).
3. Write concise, descriptive commit messages focused on the *why*, not just the *what*.
4. Push with `git push -u origin <branch-name>`.
5. Open a pull request only when explicitly requested.

### Commit message style

```
<short imperative summary under 72 chars>

<optional body explaining motivation or context>
```

## Development Guidelines for AI Assistants

- Read files before editing them.
- Do not create new files unless strictly necessary.
- Do not add features, refactor, or "clean up" beyond what is asked.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Prefer small, focused commits over large sweeping changes.
- Do not skip git hooks (`--no-verify`) or sign-off flags unless explicitly instructed.
- For destructive or irreversible actions (force push, file deletion, branch drops), confirm with the user first.

## Updating This File

Whenever the repository structure, tooling, or conventions change significantly, update this `CLAUDE.md` to reflect the current state. Keep sections concise and accurate rather than comprehensive but stale.

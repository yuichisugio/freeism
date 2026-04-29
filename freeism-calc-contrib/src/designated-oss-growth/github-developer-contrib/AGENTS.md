# Repository Guidelines

## Project Structure & Module Organization

- `main.sh` orchestrates GitHub contribution analyses for the `designated-oss-growth/github-developer-contrib` target.
- Task scripts live under `scripts/` (`get-data`, `process-data`, `calc-contrib`, plus shared `utils/`) and are invoked by `main.sh`.
- Each execution writes CSV output beneath `results/<owner>-<repo>-<since>-<until>-<timestamp>/`; check `results/main` for curated summaries.
- `archive/` stores sample artifacts and `document/` captures background references for onboarding or audit trails.

## Build, Test, and Development Commands

- `./main.sh --help` shows supported flags, default date windows, and metric toggles.
- `./main.sh -u owner/repo -s 2024-01-01 -un 2024-03-31 -t pr,star` runs a full analysis for pull requests and stars.
- `./main.sh --ratelimit` prints current GitHub API quota snapshots.
- `shellcheck scripts/**/*.sh` validates shell style; run `which gh jq curl date` to confirm required CLIs are installed.

## Coding Style & Naming Conventions

- All automation is Bash with `#!/bin/bash` and `set -euo pipefail`; indent two spaces.
- Name functions with lower_snake_case and add comments only for non-obvious logic.
- Prefer kebab-case for new directories; keep JSON files minified with alphabetized keys, mirroring `weighting.json`.

## Testing Guidelines

- Begin with `./main.sh --help` to verify argument parsing after changes.
- Exercise pipelines against a small public repo, then inspect generated CSVs inside `results/<run>/`.
- Use `shellcheck` during development; add temporary logs under `results/debug/` when tracing, then remove them before committing.

## Commit & Pull Request Guidelines

- Write terse, imperative commit subjects (e.g., `update metrics weighting`), under ~60 characters.
- Pull requests should link relevant issues, specify touched metric targets, and point to sample artifacts such as `results/<run>/summary.csv`.
- Document manual verification steps so reviewers can reproduce locally.

## Security & Configuration Tips

- Authenticate once with `gh auth login`; never hardcode tokens—pass secrets through the environment.
- Monitor long jobs with `./main.sh --ratelimit` and stage runs to avoid GitHub API exhaustion.

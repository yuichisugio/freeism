# Repository Guidelines

## Project Structure & Module Organization

The CLI targets live under `src/<strategic-goal>/<metric-target>/`. For example `src/designated-oss-growth/github-developer-contrib` hosts `main.sh`, configuration such as `weighting.json`, and topic scripts under `scripts/`. `scripts/get-data`, `scripts/process-data`, and `scripts/calc-contrib` expose integration entrypoints pulled in by `main.sh`. Each run writes to `results/<owner>-<repo>-<since>-<until>-<timestamp>/`; inspect `results/main` when present for CSV summaries. Use `archive/` for sample output and `document/` for background references.

## Build, Test, and Development Commands

Run `./main.sh --help` from a target directory to review flags and default ranges. Execute a full analysis with `./src/designated-oss-growth/github-developer-contrib/main.sh -u owner/repo -s 2024-01-01 -un 2024-03-31 -t pr,star`. Use `./main.sh --ratelimit` to print GitHub API quota snapshots. Before pushing, run `shellcheck scripts/**/*.sh` and confirm `gh`, `jq`, `curl`, and `date` are available via `which`.

## Coding Style & Naming Conventions

All automation is Bash with `#!/bin/bash` and `set -euo pipefail`. Indent two spaces and keep functions `lower_snake_case`. Name new directories with kebab-case mirroring the metric target. Preserve existing `shellcheck disable=SCxxxx` directives and document any new ones. Keep JSON minified with alphabetized keys to ease diffs.

## Testing Guidelines

Start with `./main.sh --help` to confirm argument parsing. For behaviour checks, run against a small public repo and spot-check generated CSVs inside `results/<run>/`. Add temporary logging to `results/debug` when tracing pipelines, then remove before committing. No automated test harness exists; rely on scenario-driven verification plus `shellcheck`.

## Commit & Pull Request Guidelines

Commits use short, imperative subjects such as `fix`, `update`, or `create`, staying under ~60 characters. Pull requests should link issues, explain the metric targets touched, and reference sample artefacts (`results/.../summary.csv`). List manual verification steps performed so reviewers can reproduce locally.

## Security & Configuration Tips

Authenticate once via `gh auth login` before running data jobs. Never hardcode tokens; pass secrets through the shell environment. Network-heavy runs may hit rate limits—monitor with `--ratelimit` and schedule long jobs accordingly.

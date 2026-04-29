# depchecker Guidelines

## Scope

These instructions apply to everything under `depchecker/`.

## Project Structure

- `src/software-dependencies/` contains Bash scripts for collecting software dependency data.
- `src/software-dependencies/main.sh` orchestrates the dependency checks and merges `result.json` files into a single output.
- `src/software-dependencies/scripts/` contains implementation scripts for each collection method and shared utilities.
- `src/software-dependencies/document/` contains method-specific documentation.
- `src/software-contributor/` contains Bash scripts and docs for collecting OSS contributor data.
- Generated output is written under `results/` directories. Do not commit generated result files unless the task explicitly asks for it.

## Tooling

- Use Bash-compatible shell scripts and keep `set -euo pipefail` in executable scripts.
- Required command-line tools are documented in `README.md` and method docs; confirm the relevant document before changing or running a workflow.
- Prefer existing scripts and helpers in `src/software-dependencies/scripts/utils.sh` over adding new argument parsing or tool checks.
- Keep scripts runnable from their own directory by preserving the existing `PROJECT_DIR` / `cd "$(dirname ...)"` pattern.

## Development Commands

- Run the dependency aggregator from `depchecker/src/software-dependencies/`:

  ```bash
  ./main.sh OWNER REPO
  ```

- Run contributor collectors from their method directories when implemented:

  ```bash
  ./main.sh
  ```

- If script permissions are missing, add execution permission only to the script being used:

  ```bash
  chmod +x path/to/main.sh
  ```

## Coding Style

- Prefer small, focused Bash functions with clear inputs through arguments or explicit environment variables.
- Quote variable expansions unless word splitting is intentionally required.
- Use `readonly` for constants and keep path handling explicit.
- Use `jq` for JSON transformation instead of ad hoc string manipulation.
- Print warnings to stderr and keep normal output concise.

## Testing and Verification

- For script changes, run the narrowest relevant script first.
- If network APIs or authentication are required, document the command that could not be run and the missing prerequisite.
- Validate JSON outputs with `jq` when a change affects formatting or aggregation.
- Avoid changing documented output schema unless the task explicitly requires it.

# Repository Guidelines

## Project Structure & Module Organization

This repository is a documentation project for Freeism. Markdown sources live under `doc/`: `doc/readme/` contains localized README pages, and `doc/freeism/` contains the main Freeism documents and slide material. GitHub Actions workflows are in `.github/workflows/`, and the Husky pre-commit hook is in `.husky/pre-commit`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies for the root workspace, including this documentation package.
- `pnpm --filter freeism-documentation lint`: run textlint with the repository's `.textlintrc` rules.

There is no `npm start` command or local application server in this repository.

## Coding Style & Naming Conventions

Use Markdown for content and CommonJS JavaScript for build configuration. Keep Japanese prose in `ですます` style unless a document intentionally uses another tone. Follow `.textlintrc`: prefer Japanese technical-writing rules, keep sentences concise, use `。` as the Japanese period, and preserve spacing between half-width and full-width text. Use lowercase, descriptive directory names such as `readme`, `freeism`, and `slide`. Keep language variants explicit with suffixes like `.ja.md` and `.en.md`.

## Testing Guidelines

No dedicated automated test framework or coverage target is defined. For documentation changes, run `pnpm --filter freeism-documentation lint` before committing.

## Commit & Pull Request Guidelines

The existing Git history is minimal and uses short messages such as `update`; prefer a slightly more descriptive imperative summary, for example `Update Japanese Freeism doc`. Pull requests should describe the changed documents, list the commands run, and note whether PDF output changed. Include screenshots or a PDF sample when layout, tables, or slide content changes. Link related issues when available.

## Security & Configuration Tips

Do not commit generated release artifacts unless the workflow or maintainer asks for them. Keep workflow secrets out of the repository; the release workflow relies on GitHub-provided `GITHUB_TOKEN`.

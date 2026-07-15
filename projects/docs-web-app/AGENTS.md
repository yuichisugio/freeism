# Repository Guidelines

## Project Structure & Module Organization

This project contains the Freeism documentation site. Canonical Markdown sources live under `src/`: `freeism.{ja,en}.md` contains the main documents, `note/` contains localized notes, and `readme/` contains the Japanese README. Astro pages live under `pages/`, with Blume configuration in `blume.config.ts`. GitHub Actions workflows are in the repository root under `.github/workflows/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies for the root workspace, including this documentation package.
- `pnpm --filter docs-web-app lint`: run textlint with the project's `.textlintrc` rules.
- `pnpm --filter docs-web-app check`: run Astro and TypeScript diagnostics.
- `pnpm --filter docs-web-app test`: run the package's current test entry point.
- `pnpm --filter docs-web-app build`: build the static documentation site.

Use `pnpm --filter docs-web-app dev` to run the local Astro development server.

## Coding Style & Naming Conventions

Use Markdown for canonical content and TypeScript/Astro for the site implementation. Keep Japanese prose in `ですます` style unless a document intentionally uses another tone. Follow `.textlintrc`: prefer Japanese technical-writing rules, keep sentences concise, use `。` as the Japanese period, and preserve spacing between half-width and full-width text. Use lowercase, descriptive directory names. Keep language variants explicit with suffixes like `.ja.md` and `.en.md`.

## Testing Guidelines

Vitest contract tests verify canonical source integrity and the production route/search output. For documentation-site changes, run `pnpm --filter docs-web-app test`, `lint`, `check`, and `build` before committing.

## Commit & Pull Request Guidelines

The existing Git history is minimal and uses short messages such as `update`; prefer a slightly more descriptive imperative summary, for example `Update Japanese Freeism doc`. Pull requests should describe the changed documents, list the commands run, and note whether PDF output changed. Include screenshots or a PDF sample when layout, tables, or slide content changes. Link related issues when available.

## Security & Configuration Tips

Do not commit generated release artifacts unless the workflow or maintainer asks for them. Keep workflow secrets out of the repository; the release workflow relies on GitHub-provided `GITHUB_TOKEN`.

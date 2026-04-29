# Repository Guidelines

## Project Structure & Module Organization

Keep feature code in `src/app` and shared UI in `src/components`. Server actions and helpers live in `src/actions` and
`src/lib`, while `src/emails`, `src/hooks`, and `src/types` hold specialized React email templates, hooks, and typings.
Persisted data models reside in `prisma/` (schema and seeds), scheduled jobs in `scripts/`, and static assets in
`public/`. Product docs live in `specification/`. Co-locate tests beside the code they cover and place reusable fixtures
under `src/test`.

## Build, Test, and Development Commands

Install dependencies with `pnpm install` (Node ≥ 20). Use `pnpm dev` for the web app on port 3000 and `pnpm email:dev`
for the mail preview on 3001. Create production bundles via `pnpm build` followed by `pnpm start`. Before shipping, run
`pnpm lint`, `pnpm typecheck`, and `pnpm format`. Execute automated suites with `pnpm test`, or choose `pnpm test:watch`
during iteration and `pnpm test:coverage` for merge readiness.

## Coding Style & Naming Conventions

Prettier enforces two-space indentation and trailing commas; run `pnpm format:fix` before committing. ESLint
(`eslint.config.mjs`) plus the sort-imports plugin governs import order, accessibility, and TanStack Query patterns.
Name components in PascalCase, hooks in camelCase, and align file names with their default export. Favor Tailwind
utilities for styling and keep environment-aware utilities in `src/lib`.

## Testing Guidelines

Vitest with Happy DOM and Testing Library powers unit and integration coverage. Name specs `*.test.ts` or `*.test.tsx`,
mirroring the source directory. Target data fetching, query invalidation, and auth guards with integration-style tests.
Use `src/test` solely for shared fixtures. Maintain coverage thresholds by running `pnpm test:coverage` before reviews.

## Commit & Pull Request Guidelines

Follow Conventional Commits (`feat:`, `fix:`, etc.) and use `pnpm commit` for Commitizen prompts. Keep changes atomic
and include Prisma migrations or seeds when schema updates occur. Pull requests should summarize impact, link the
relevant Linear/GitHub issue, list verification commands, and attach UI previews or environment notes as needed.

## Database & Environment Notes

Duplicate `.env.example` to `.env`, keeping secrets local. Supabase PostgreSQL powers persistence: run
`pnpm prisma migrate dev` to evolve the schema and `pnpm db:seed` for idempotent seeding. Use `pnpm clean` only when you
intentionally want to reset generated artifacts.

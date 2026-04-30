# Repository Guidelines

Claude Code（claude.ai/code）およびこのリポジトリで作業するコーディングエージェント向けの指針です。

## Conversation Guidelines

- 常に日本語で会話する

## Development Philosophy

### Test-Driven Development (TDD)

- 原則としてテスト駆動開発（TDD）で進める
- 期待される入出力に基づき、まずテストを作成する
- 実装コードは書かず、テストのみを用意する
- テストを実行し、失敗を確認する
- テストが正しいことを確認できた段階でコミットする
- その後、テストをパスさせる実装を進める
- 実装中はテストを変更せず、コードを修正し続ける
- すべてのテストが通過するまで繰り返す

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

### Core Development

- `pnpm dev` - Start development server on port 3000
- `pnpm email:dev` - Mail preview on port 3001
- `pnpm build` - Build production application
- `pnpm start` - Run production server
- `pnpm test` - Run all tests with Vitest
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:ui` - Open Vitest UI
- `pnpm typecheck` - TypeScript type checking

### Code Quality

- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues and validate Prisma schema
- `pnpm format` / `pnpm format:fix` - Check or apply Prettier and Prisma format
- `pnpm unused:check` - Check for unused code with Knip

### Database Operations

- `pnpm db:seed` - Seed database with test data
- `pnpm db:seed:with-actions` - Seed database and run all scheduled actions
- `pnpm prisma:dev:migrate` - Run Prisma migrations in development
- `pnpm prisma:prod:deploy` - Deploy Prisma migrations in production

Developmentではスキーマ変更に `pnpm prisma migrate dev` を使うこともできる。

### Background Scripts

- `pnpm actions:update-auction-status-to-active` - Activate scheduled auctions
- `pnpm actions:update-auction-status-to-completed` - Complete ended auctions
- `pnpm actions:return-auction-deposit-points` - Return deposit points
- `pnpm actions:send-scheduled-notifications` - Send scheduled notifications

### Single Test Execution

To run a single test file, use: `pnpm vitest path/to/test.file.test.ts`

## Coding Style & Naming Conventions

Prettier enforces two-space indentation and trailing commas; run `pnpm format:fix` before committing. ESLint
(`eslint.config.mjs`) plus the sort-imports plugin governs import order, accessibility, and TanStack Query patterns.
Name components in PascalCase, hooks in camelCase, and align file names with their default export. Favor Tailwind
utilities for styling and keep environment-aware utilities in `src/lib`.

## Testing Guidelines

Vitest with Happy DOM and Testing Library powers unit and integration coverage. Name specs `*.test.ts` or `*.test.tsx`,
mirroring the source directory. Target data fetching, query invalidation, and auth guards with integration-style tests.
Use `src/test` solely for shared fixtures. Maintain coverage thresholds by running `pnpm test:coverage` before reviews.

- **MSW** for API mocking where appropriate
- Comprehensive setup files for different testing scenarios
- 90% line coverage target with specific thresholds

## Commit & Pull Request Guidelines

Prefer Conventional Commits-style prefixes (`feat:`, `fix:`, etc.) when feasible. Keep changes atomic and include Prisma
migrations or seeds when schema updates occur. Pull requests should summarize impact, link the relevant Linear/GitHub
issue, list verification commands, and attach UI previews or environment notes as needed.

## Database & Environment Notes

Duplicate `.env.example` to `.env.local`, keeping secrets local. Supabase PostgreSQL powers persistence: run
`pnpm prisma migrate dev` to evolve the schema and `pnpm db:seed` for idempotent seeding. Use `pnpm clean` only when you
intentionally want to reset generated artifacts.

## Architecture Overview

### Application Structure

This is a Next.js 15 application using the App Router pattern with a comprehensive auction/task management system. The
application follows a domain-driven design with clear separation of concerns.

### Key Architectural Patterns

#### Authentication & Authorization

- **NextAuth v5** with Google OAuth provider in `src/auth.ts`
- Custom middleware in `src/middleware.ts` protecting `/dashboard/*` routes
- Session-based authentication with JWT strategy
- Role-based permissions (app owners, group owners, members)

#### Database Layer

- **Prisma ORM** with PostgreSQL and Supabase
- Complex schema with auction, task, group, and notification systems
- Database extensions: `pg_bigm` for full-text search capabilities
- Optimized indexes for performance-critical queries

#### Data Layer Architecture

- **Server Actions Pattern**: Data mutations through server actions in `src/actions/`
- **Cache Layer**: Domain-specific cache utilities co-located under action modules (e.g. `src/actions/*/cache/`)
- **Granular Actions**: Domain-specific actions (auction, group, task, notification)

#### State Management

- **TanStack Query** for server state management
- Comprehensive cache key factory in `src/lib/tanstack-query.ts`
- IndexedDB persistence for offline capability
- Custom hooks in `src/hooks/` for component-specific state logic

#### Component Architecture

- **Radix UI** primitives for accessible components
- **shadcn/ui** component system in `src/components/ui/`
- Domain-specific components organized by feature (auction, group, task, notification)
- Shared components in `src/components/share/`

#### Real-time Features

- **Server-Sent Events (SSE)** for auction bid updates
- **Web Push Notifications** with VAPID keys
- Redis integration for real-time data synchronization

#### File Upload System

- **Cloudflare R2** integration for file storage
- Pre-signed URL generation for secure uploads
- Image validation and processing utilities

### Domain Models

#### Core Entities

- **User**: Authentication, settings, group memberships
- **Group**: Task containers with member management and point systems
- **Task**: Work items with auction capabilities and status workflows
- **Auction**: Bidding system with auto-bid, extensions, and real-time updates
- **Notification**: Multi-channel notifications (email, push, in-app)

#### Key Relationships

- Users belong to multiple Groups through GroupMembership
- Tasks belong to Groups and can have associated Auctions
- Auctions have BidHistory, AutoBid settings, and AuctionReviews
- Notifications support multiple delivery methods and targeting

### Type Safety & Validation

- **TypeScript** with strict configuration
- **Zod** schemas for runtime validation in `src/lib/zod-schema.ts`
- **@t3-oss/env-nextjs** for type-safe environment variables
- Custom type definitions in `src/types/`

### Performance Optimizations

- App Router with streaming and suspense
- React Query with infinite cache and persistence
- Optimized database queries with strategic indexing
- Image optimization with Next.js Image component

### Background Processing

- Scheduled scripts in `scripts/` directory for auction lifecycle management
- Notification queue processing
- Point system calculations and deposits

When working on this codebase:

1. Follow the established server action pattern for data mutations
2. Use the cache utilities for performance-critical operations
3. Implement proper error handling in all server actions
4. Write comprehensive tests for new functionality
5. Utilize the type-safe environment variable system
6. Follow the component organization patterns by domain

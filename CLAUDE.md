# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Development Commands

### Core Development

- `pnpm dev` - Start development server on port 3000
- `pnpm build` - Build production application
- `pnpm test` - Run all tests with Vitest
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:ui` - Open Vitest UI
- `pnpm typecheck` - TypeScript type checking

### Code Quality

- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues and validate Prisma schema
- `pnpm format:fix` - Format code with Prettier and format Prisma schema
- `pnpm unused:check` - Check for unused code with Knip

### Database Operations

- `pnpm db:seed` - Seed database with test data
- `pnpm db:seed:with-actions` - Seed database and run all scheduled actions
- `pnpm prisma:dev:migrate` - Run Prisma migrations in development
- `pnpm prisma:prod:deploy` - Deploy Prisma migrations in production

### Background Scripts

- `pnpm actions:update-auction-status-to-active` - Activate scheduled auctions
- `pnpm actions:update-auction-status-to-completed` - Complete ended auctions
- `pnpm actions:return-auction-deposit-points` - Return deposit points
- `pnpm actions:send-scheduled-notifications` - Send scheduled notifications

### Single Test Execution

To run a single test file, use: `pnpm vitest path/to/test.file.test.ts`

## Architecture Overview

### Application Structure

This is a Next.js 15 application using the App Router pattern with a comprehensive auction/task management system. The application follows a
domain-driven design with clear separation of concerns.

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

- **Server Actions Pattern**: All data mutations through server actions in `src/lib/actions/`
- **Cache Layer**: Dedicated cache utilities in `src/lib/actions/cache/`
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

### Testing Strategy

- **Vitest** as test runner with Happy DOM environment
- **Testing Library** for component testing
- **MSW** for API mocking
- Comprehensive setup files for different testing scenarios
- 90% line coverage target with specific thresholds

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

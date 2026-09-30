# Freeism Points Web App

## Language

[日本語](docs/readme/README.ja.md) | English(This page)

## Overview

A points management service related to Freeism.

## Details

- Evaluation criteria management
- Package management
- Point grants and balances
- Freeism Points' own OAuth provider and API
- External account management, ownership proof, publication, and lookup use `projects/accounts-web-app` as the connected information service.
- Points managed here are spent through `projects/markets-web-app`.

## Technical approach

- Cloudflare Workers, Workers Static Assets, and D1
- Hono, Drizzle, and Better Auth
- TanStack Start and Vite+
- Use SPA and SSG. Do not use runtime SSR or Server Functions.

## Documentation

- [v0.1](docs/specification/v0.1/index.ja.md)
- [v0.2](docs/specification/v0.2/index.ja.md)
- [v0.3](docs/specification/v0.3/index.ja.md)
- [v0.4](docs/specification/v0.4/index.ja.md)

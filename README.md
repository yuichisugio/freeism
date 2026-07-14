# freeism

- [freeism](#freeism)
  - [Language](#language)
  - [Overview](#overview)
  - [Folder structure](#folder-structure)

## Language

[日本語](docs/README.ja.md) | English(This page)

## Overview

- A monorepo for web apps, analysis tools, and specification documents related to Freeism.

## Folder structure

| Path                                                       | Description                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`projects/main-web-app/`](./projects/main-web-app/)       | `freeism.app` portal                                                                            |
| [`projects/docs-web-app/`](./projects/docs-web-app/)       | `docs.freeism.app` Blume documentation site and Freeism specification                           |
| [`docs/`](./docs/)                                         | Markdown for the repository root (this README in Japanese, the Japanese code of conduct, etc.). |
| [`projects/points-web-app/`](./projects/points-web-app/)   | `points.freeism.app` frontend/backend specs and implementation plan                             |
| [`projects/markets-web-app/`](./projects/markets-web-app/) | `markets.freeism.app` frontend/backend specs and implementation plan                            |
| [`projects/web-app/`](./projects/web-app/)                 | Legacy Next.js implementation retained until the v0.2 cutover                                   |
| [`docs/web-app/`](./docs/web-app/)                         | Cross-app architecture, authentication, API, security, and migration manifest                   |
| [`projects/calc-contrib/`](./projects/calc-contrib/)       | Software that calculates contribution scores                                                    |
| [`projects/depchecker/`](./projects/depchecker/)           | Software that fetches dependencies                                                              |

```
freeism/
├── README.md                 # README (English)
├── CODE_OF_CONDUCT.md        # Code of conduct (English)
├── LICENSE                   # License
├── docs/                     # Documentation for this repository
└── projects/                 # Monorepo projects
    ├── docs-web-app/         # Freeism specification
    ├── main-web-app/         # freeism.app portal
    ├── points-web-app/       # points.freeism.app
    ├── markets-web-app/      # markets.freeism.app
    ├── web-app/              # Legacy app until v0.2 cutover
    ├── calc-contrib/         # Contribution calculation
    └── depchecker/           # Dependency fetching
```

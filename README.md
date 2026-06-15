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

| Path                                 | Description                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`projects/documentation/`](./projects/documentation/) | Freeism specification |
| [`docs/`](./docs/)                   | Markdown for the repository root (this README in Japanese, the Japanese code of conduct, etc.).                                                   |
| [`projects/web-app/`](./projects/web-app/)             | web app |
| [`projects/calc-contrib/`](./projects/calc-contrib/)   | Software that calculates contribution scores |
| [`projects/depchecker/`](./projects/depchecker/)       | Software that fetches dependencies                                                         |

```
freeism/
├── README.md                 # README (English)
├── CODE_OF_CONDUCT.md        # Code of conduct (English)
├── LICENSE                   # License
├── docs/                     # Documentation for this repository
└── projects/                 # Monorepo projects
    ├── documentation/        # Freeism specification
    ├── web-app/              # Freeism app
    ├── calc-contrib/         # Contribution calculation
    └── depchecker/           # Dependency fetching
```

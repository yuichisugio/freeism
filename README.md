# freeism

- [freeism](#freeism)
  - [Language](#language)
  - [Overview](#overview)
  - [Folder structure](#folder-structure)

## Language

[README（日本語）](docs/README.ja.md) | README (English)

## Overview

- A monorepo for web apps, analysis tools, and specification documents related to Freeism.

## Folder structure

| Path                                 | Description                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`documentation/`](./documentation/) | Freeism specification |
| [`docs/`](./docs/)                   | Markdown for the repository root (this README in Japanese, the Japanese code of conduct, etc.).                                                   |
| [`web-app/`](./web-app/)             | web app |
| [`calc-contrib/`](./calc-contrib/)   | Software that calculates contribution scores |
| [`depchecker/`](./depchecker/)       | Software that fetches dependencies                                                         |

```
freeism/
├── README.md                 # README (English)
├── CODE_OF_CONDUCT.md        # Code of conduct (English)
├── LICENSE                   # License
├── docs/                     # Documentation for this repository
├── documentation/           # Freeism specification
├── web-app/                  # Freeism app
├── calc-contrib/             # Contribution calculation
└── depchecker/               # Dependency fetching
```

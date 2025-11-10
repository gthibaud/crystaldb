# CrystalDB Monorepo

CrystalDB now ships as a multi-package workspace so the same domain model can be reused across runtimes:

- `@crystaldb/core` – shared types, kind registry, and serialization helpers suitable for any environment (including browsers and Go bindings).
- `@crystaldb/node` – the runtime `CrystalDB` class plus Mongo/Mongoose adapters and validation hooks.
- `@crystaldb/react` – placeholder for upcoming React display/editor components built on top of the core package.

This layout keeps the cross-language contracts (types, serializers, validators) in a dependency-free package so they can be consumed from React, Go, or other ecosystems while the Node package continues to own persistence logic.

## Features

- Automatic technical ID generation (via [`gthibaud-uid`](https://www.npmjs.com/package/gthibaud-uid)) for unit types, data items, and units—callers only interact with business-friendly identifiers.
- Dedicated serializers/deserializers for core data item kinds (`string`, `markdown`, `number`, `percentage`, `geoAddress`, `reference`) to keep stored payloads normalized while exposing rich domain types to callers, plus a public `registerKind` API to plug in custom kinds.
- Simple validation hook that can be wired to an external microservice before writes.
- Adapter-based persistence layer so that MongoDB is just one backend; swap in another database by implementing the adapter contract.
- Rich metadata and documentation model with localized names/descriptions plus configurable audit fields (`createdAt`, `updatedBy`, etc.) and built-in status tracking for units and individual data items.

## Quick Start

```bash
npm install
npm run build
```

You can also build individual packages:

```bash
npm run build --workspace @crystaldb/core
npm run build --workspace @crystaldb/node
```

## Scripts

- `npm run build` — Compile every workspace into its `dist/` folder.
- `npm test` — Execute the Jest test suite against an in-memory MongoDB instance.
- `npm run lint` — Lint the workspace packages using ESLint.
- `npm run format` — Apply Prettier formatting across `packages/` and `tests/`.

## Testing Strategy

Integration-style tests use `mongodb-memory-server`, so no external MongoDB instance is required. If you provide your own MongoDB connection string via environment variables later on, tests can be adapted to reuse it without changing the library code.

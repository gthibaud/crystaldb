# CrystalDB

CrystalDB is a TypeScript library that wraps MongoDB with Crystalchain-specific concepts such as unit types and units. It relies on an externally managed `MongoClient` instance, stores unit types and units in dedicated collections within the same database, and provides hooks to run synchronous validation before write operations.

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

## Scripts

- `npm run build` — Compile the TypeScript sources into `dist/`.
- `npm test` — Execute the Jest test suite against an in-memory MongoDB instance.
- `npm run lint` — Lint the project using ESLint.
- `npm run format` — Apply Prettier formatting to `src/` and `tests/`.

## Testing Strategy

Integration-style tests use `mongodb-memory-server`, so no external MongoDB instance is required. If you provide your own MongoDB connection string via environment variables later on, tests can be adapted to reuse it without changing the library code.

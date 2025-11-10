# CrystalDB Monorepo

CrystalDB now ships as a multi-package workspace so the same domain model can be reused across runtimes:

- `@crystaldb/core` – shared types, kind registry, and serialization helpers suitable for any environment (including browsers and Go bindings).
- `@crystaldb/node` – the runtime `CrystalDB` class plus Mongo/Mongoose adapters and validation hooks.
- `@crystaldb/react` – placeholder for upcoming React display/editor components built on top of the core package.

This layout keeps the cross-language contracts (types, serializers, validators) in a dependency-free package so they can be consumed from React, Go, or other ecosystems while the Node package continues to own persistence logic.

## Features

- Automatic technical ID generation (via [`gthibaud-uid`](https://www.npmjs.com/package/gthibaud-uid)) for unit types, data items, and units—callers only interact with business-friendly identifiers.
- Dedicated serializers/deserializers for core data item kinds (`string`, `markdown`, `number`, `percentage`, `geoAddress`, `reference`) to keep stored payloads normalized while exposing rich domain types to callers, plus a public `registerKind` API to plug in custom kinds.
- Inline-first API: register TypeScript classes with `registerUnitTypeClass` and let `CrystalDB` materialize strongly typed objects automatically. When you need database-driven schemas, use the `crystal.dynamic` namespace without losing serialization parity.
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

## Workflows

CrystalDB exposes two complementary workflows built on the same serialization layer.

### Inline TypeScript bindings (default)

Register a class against a unit type definition and work with rich instances throughout your codebase. Inline definitions never touch the database unless you explicitly persist them.

```ts
import {
    registerUnitTypeClass,
    type UnitClassInstance,
    type UnitTypeDefinition,
} from "@crystaldb/core";
import { CrystalDB, createMongoAdapter } from "@crystaldb/node";

const invoiceDefinition: UnitTypeDefinition = {
    id: "unitType:invoice",
    documentation: { name: "Invoice", description: "Invoice record" },
    items: [
        { id: "number", type: "string", documentation: { name: "Number", description: "" } },
        { id: "total", type: "number", documentation: { name: "Total", description: "" } },
    ],
};

class InvoiceUnit implements UnitClassInstance {
    id?: string;
    unitTypeId?: string;
    values = {};
    number?: string | null;
    total?: number | null;
}

registerUnitTypeClass({ definition: invoiceDefinition, ctor: InvoiceUnit });

// Assume you already created a MongoClient named `client`.
const crystal = new CrystalDB({
    adapter: createMongoAdapter({ client, dbName: "crystaldb" }),
});
await crystal.initialize();

const invoice = new InvoiceUnit();
invoice.number = "INV-2025-001";
invoice.total = 1200;

await crystal.createUnit(invoice); // inline-first API
const persistedInvoice = await crystal.getUnitById(InvoiceUnit, invoice.id!);
const invoices = await crystal.listUnits(InvoiceUnit);

const inlineDefinitions = crystal.listInlineUnitTypes();
// => [invoiceDefinition, ...]
```

### Dynamic database-backed definitions

When you need to persist unit type schemas in the database (multi-tenant systems, admin consoles, etc.), use the `dynamic` namespace. The same serializers/deserializers are shared with the inline workflow, so units can flow between both models seamlessly.

```ts
await crystal.dynamic.upsertUnitType(invoiceDefinition);

const created = await crystal.dynamic.create({
    unitTypeId: invoiceDefinition.id,
    values: { number: "INV-2025-002", total: 830 },
});

const fetched = await crystal.dynamic.getById(created.id);
const listed = await crystal.dynamic.list(invoiceDefinition.id, {
    order: { businessId: "desc" },
});
```

The inline and dynamic APIs produce identical stored payloads, which means migrations between both strategies only require re-registering definitions instead of rewriting business logic.

## Scripts

- `npm run build` — Compile every workspace into its `dist/` folder.
- `npm test` — Execute the Jest test suite against an in-memory MongoDB instance.
- `npm run lint` — Lint the workspace packages using ESLint.
- `npm run format` — Apply Prettier formatting across `packages/` and `tests/`.

## Testing Strategy

Integration-style tests use `mongodb-memory-server`, so no external MongoDB instance is required. If you provide your own MongoDB connection string via environment variables later on, tests can be adapted to reuse it without changing the library code.

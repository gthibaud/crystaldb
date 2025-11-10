import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

jest.mock(
    "gthibaud-uid",
    () => {
        let counter = 0;
        return {
            idAlphabet: "mock",
            idLength: 12,
            idRegex: /^[a-z]+$/i,
            generateId: jest.fn(() => `mocked-id-${++counter}`),
            isValidId: jest.fn().mockReturnValue(true),
        };
    },
    { virtual: true }
);

import type { Unit, UnitTypeDefinition } from "@crystaldb/core";
import { CrystalDB, createMongooseAdapter } from "@crystaldb/node";

describe("MongooseDatabaseAdapter", () => {
    let mongod: MongoMemoryServer;
    let connection: mongoose.Connection;
    const databaseName = "crystaldb-mongoose-test";

    const unitTypeDefinition: UnitTypeDefinition = {
        id: "unitType:test",
        documentation: {
            name: "Test",
            description: "Test unit type",
        },
        items: [
            {
                id: "name",
                type: "string",
                documentation: {
                    name: "Name",
                    description: "Name of the entity",
                },
            },
            {
                id: "score",
                type: "number",
                documentation: {
                    name: "Score",
                    description: "Score of the entity",
                },
            },
        ],
    };

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        connection = await mongoose
            .createConnection(mongod.getUri(), {
                dbName: databaseName,
                maxPoolSize: 5,
            })
            .asPromise();
    });

    afterAll(async () => {
        await connection.close();
        await mongod.stop();
    });

    beforeEach(async () => {
        await connection.dropDatabase();
    });

    it("persists unit types and units through CrystalDB", async () => {
        const adapter = createMongooseAdapter({ connection });
        const crystalDb = new CrystalDB({ adapter });

        await crystalDb.initialize();

        const storedUnitType = await crystalDb.upsertUnitType(unitTypeDefinition);

        expect(storedUnitType.id).toBe(unitTypeDefinition.id);
        expect(storedUnitType.items).toHaveLength(unitTypeDefinition.items.length);

        const createdUnitResult = await crystalDb.dynamic.create({
            unitTypeId: unitTypeDefinition.id,
            values: {
                name: "Alice",
                score: 42,
            },
        });
        const createdUnit = createdUnitResult as unknown as Unit;

        expect(createdUnit.unitTypeId).toBe(unitTypeDefinition.id);
        expect(createdUnit.values.name).toBe("Alice");
        expect(createdUnit.values.score).toBe(42);

        const updatedUnitResult = await crystalDb.dynamic.update(createdUnit.id, {
            values: { score: 84 },
        });
        const updatedUnit = updatedUnitResult as unknown as Unit | null;

        expect(updatedUnit).not.toBeNull();
        expect(updatedUnit?.values.name).toBe("Alice");
        expect(updatedUnit?.values.score).toBe(84);

        const fetchedResult = await crystalDb.dynamic.getById(createdUnit.id);
        const fetched = fetchedResult as unknown as Unit | null;
        expect(fetched).not.toBeNull();
        expect(fetched?.values.score).toBe(84);

        const sameType = await crystalDb.getUnitTypeById(unitTypeDefinition.id);
        expect(sameType).not.toBeNull();
        expect(sameType?.items).toHaveLength(unitTypeDefinition.items.length);

        const listedUnitsResult = await crystalDb.dynamic.list(unitTypeDefinition.id, {
            filters: {
                businessId: { value: createdUnit.id },
            },
        });
        const listedUnits = listedUnitsResult as unknown as Unit[];

        expect(listedUnits).toHaveLength(1);
        expect(listedUnits[0]?.id).toBe(createdUnit.id);
    });
});

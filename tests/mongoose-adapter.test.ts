import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

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

import { CrystalDB } from "../src";
import { createMongooseAdapter } from "../src/adapters/mongoose";
import type { UnitTypeDefinition } from "../src/types";

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

        const createdUnit = await crystalDb.createUnit({
            unitTypeId: unitTypeDefinition.id,
            values: {
                name: "Alice",
                score: 42,
            },
        });

        expect(createdUnit.unitTypeId).toBe(unitTypeDefinition.id);
        expect(createdUnit.values.name).toBe("Alice");
        expect(createdUnit.values.score).toBe(42);

        const updatedUnit = await crystalDb.updateUnit(createdUnit.id, {
            values: { score: 84 },
        });

        expect(updatedUnit).not.toBeNull();
        expect(updatedUnit?.values.name).toBe("Alice");
        expect(updatedUnit?.values.score).toBe(84);

        const fetched = await crystalDb.getUnitById(createdUnit.id);
        expect(fetched).not.toBeNull();
        expect(fetched?.values.score).toBe(84);

        const sameType = await crystalDb.getUnitTypeById(unitTypeDefinition.id);
        expect(sameType).not.toBeNull();
        expect(sameType?.items).toHaveLength(unitTypeDefinition.items.length);
    });
});


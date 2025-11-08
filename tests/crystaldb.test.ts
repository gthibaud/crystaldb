import { MongoClient } from "mongodb";
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

import { CrystalDB, UnitTypeDefinition } from "../src";
import { createMongoAdapter } from "../src/adapters/mongo";
import type { GeoAddressValue } from "../src/kinds/geoAddress/types";
import type { PercentageValue } from "../src/kinds/percentage/types";
import type { ReferenceValue } from "../src/kinds/reference/types";

describe("CrystalDB", () => {
    let mongod: MongoMemoryServer;
    let client: MongoClient;
    const databaseName = "crystaldb-test";

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        client = await MongoClient.connect(mongod.getUri(), {
            maxPoolSize: 5,
        });
    });

    afterAll(async () => {
        await client.close();
        await mongod.stop();
    });

    const baseUnitType: UnitTypeDefinition = {
        id: "unitType:user",
        documentation: {
            name: {
                default: "User",
            },
            description: {
                default: "Crystalchain platform user.",
            },
            icon: "users",
            tags: ["core", "people"],
        },
        items: [
            {
                id: "name",
                type: "string",
                documentation: {
                    name: "Full name",
                    description: "Name of the user.",
                },
            },
            {
                id: "bio",
                type: "markdown",
                documentation: {
                    name: "Biography",
                    description: "Markdown description.",
                },
            },
            {
                id: "age",
                type: "number",
                documentation: {
                    name: "Age",
                    description: "Age of the user.",
                },
                metadata: {
                    required: false,
                    immutable: false,
                },
            },
            {
                id: "progress",
                type: "percentage",
                documentation: {
                    name: "Completion",
                    description: "Completion percentage.",
                },
                metadata: {
                    status: {
                        allowed: {
                            completionStatus: {
                                type: "completionStatus",
                                value: "in-progress",
                            },
                        },
                    },
                },
            },
            {
                id: "active",
                type: "boolean",
                documentation: {
                    name: "Active",
                    description: "Whether the user is active.",
                },
            },
            {
                id: "ageRange",
                type: "numberRange",
                documentation: {
                    name: "Age interval",
                    description: "Age interval.",
                },
            },
            {
                id: "joinedAt",
                type: "date",
                documentation: {
                    name: "Join date",
                    description: "Join date.",
                },
            },
            {
                id: "billingMonth",
                type: "month",
                documentation: {
                    name: "Billing month",
                    description: "Billing month.",
                },
            },
            {
                id: "role",
                type: "enum",
                documentation: {
                    name: "Role",
                    description: "Role enumeration.",
                },
                metadata: {
                    enumValues: [
                        { key: "admin", label: "Admin" },
                        { key: "user", label: "User" },
                    ],
                },
            },
            {
                id: "attachments",
                type: "files",
                documentation: {
                    name: "Attachments",
                    description: "Attached files.",
                },
                metadata: {
                    maxFiles: 10,
                },
            },
            {
                id: "bonusFormula",
                type: "formula",
                documentation: {
                    name: "Bonus formula",
                    description: "Formula configuration.",
                },
            },
            {
                id: "vacation",
                type: "dateRange",
                documentation: {
                    name: "Vacation",
                    description: "Vacation range.",
                },
            },
            {
                id: "commute",
                type: "distance",
                documentation: {
                    name: "Commute distance",
                    description: "Commute distance.",
                },
            },
            {
                id: "avatar",
                type: "icon",
                documentation: {
                    name: "Avatar",
                    description: "Preferred icon.",
                },
            },
            {
                id: "location",
                type: "geoAddress",
                documentation: {
                    name: "Location",
                    description: "Geographic address.",
                },
            },
            {
                id: "manager",
                type: "reference",
                documentation: {
                    name: "Manager",
                    description: "Reference to another user.",
                },
            },
        ],
        metadata: {
            createdAt: true,
            updatedAt: true,
            createdBy: true,
            updatedBy: true,
            enableVersioning: true,
            trackStatusHistory: true,
            statusCatalog: {
                completionStatus: {
                    type: "completionStatus",
                    value: "draft",
                },
            },
        },
    };

    const clearDatabase = async () => {
        const db = client.db(databaseName);
        const collections = await db.collections();
        await Promise.all(collections.map((collection) => collection.deleteMany({})));
    };

    const buildCrystalDB = async () => {
        const adapter = createMongoAdapter({
            client,
            dbName: databaseName,
        });
        const crystal = new CrystalDB({
            adapter,
        });
        await crystal.initialize();
        return crystal;
    };

    beforeEach(async () => {
        await clearDatabase();
    });

    it("persists unit types in the dedicated collection", async () => {
        const crystal = await buildCrystalDB();
        await crystal.upsertUnitType(baseUnitType);
        const stored = await crystal.getUnitTypeById(baseUnitType.id);

        expect(stored).not.toBeNull();
        expect(stored?.items).toHaveLength(baseUnitType.items.length);
        expect(stored?.createdAt).toBeInstanceOf(Date);
    });

    it("stores units separately from unit types", async () => {
        const crystal = await buildCrystalDB();
        await crystal.upsertUnitType(baseUnitType);

        const unit = await crystal.createUnit({
            type: baseUnitType.id,
            values: {
                name: "John Doe",
                bio: "# Heading",
                age: 32,
                progress: { value: 42.5 },
                active: true,
                ageRange: { start: 25, end: 40 },
                joinedAt: "2024-01-10T12:00:00Z",
                billingMonth: "2024-02",
                role: { key: "manager", label: "Manager" },
                attachments: [{ id: "file-1", name: "cv.pdf", url: "https://files.test/cv.pdf" }],
                bonusFormula: { expression: "base * 0.1" },
                vacation: {
                    start: { iso: "2024-08-01T00:00:00.000Z" },
                    end: { iso: "2024-08-10T00:00:00.000Z" },
                },
                commute: { value: 12.5, unit: "km" },
                avatar: { name: "user", color: "#123456" },
                location: {
                    label: "Crystal HQ",
                    coordinates: { latitude: 48.8566, longitude: 2.3522 },
                    country: "France",
                },
                manager: {
                    unitId: "manager-123",
                    unitType: baseUnitType.id,
                },
            },
            metadata: {
                createdBy: "tester",
            },
        });

        expect(unit.id).toBeDefined();
        expect(unit.values.name).toBe("John Doe");
        expect(unit.values.bio).toBe("# Heading");
        expect(unit.values.age).toBe(32);
        const progress = unit.values.progress as PercentageValue | null;
        const location = unit.values.location as GeoAddressValue | null;
        const manager = unit.values.manager as ReferenceValue | null;
        const vacation = unit.values.vacation as {
            start: { iso: string };
            end: { iso: string };
        } | null;

        expect(progress?.value).toBeCloseTo(42.5);
        expect(location?.coordinates?.latitude).toBeCloseTo(48.8566);
        expect(manager?.unitId).toBe("manager-123");
        expect(unit.values.active).toBe(true);
        expect((unit.values.ageRange as { start: number; end: number })?.start).toBe(25);
        expect((unit.values.joinedAt as { iso: string })?.iso).toBe("2024-01-10T12:00:00.000Z");
        expect((unit.values.billingMonth as { month: string })?.month).toBe("2024-02");
        expect((unit.values.role as { key: string })?.key).toBe("manager");
        expect((unit.values.attachments as Array<{ id: string }>)[0]?.id).toBe("file-1");
        expect((unit.values.bonusFormula as { expression: string })?.expression).toBe("base * 0.1");
        expect(vacation?.start.iso).toBe("2024-08-01T00:00:00.000Z");
        expect((unit.values.commute as { value: number })?.value).toBeCloseTo(12.5);
        expect((unit.values.avatar as { name: string })?.name).toBe("user");

        const db = client.db(databaseName);
        const storedUnit = await db.collection("units").findOne({ id: unit.id });
        const storedUnitType = await db.collection("unitTypes").findOne({ id: baseUnitType.id });

        expect(storedUnit?.type).toBe(baseUnitType.id);
        expect(storedUnit?.values?.name).toBe("John Doe");
        expect(storedUnit?.values?.bio).toBe("# Heading");
        expect(storedUnit?.values?.age).toBe(32);
        expect(storedUnit?.values?.progress).toBe(4250);
        expect(storedUnit?.values?.active).toBe(true);
        expect(storedUnit?.values?.ageRange).toEqual({ start: 25, end: 40 });
        expect(storedUnit?.values?.joinedAt?.iso).toBe("2024-01-10T12:00:00.000Z");
        expect(storedUnit?.values?.billingMonth?.month).toBe("2024-02");
        expect(storedUnit?.values?.role).toEqual({ key: "manager", label: "Manager" });
        expect(storedUnit?.values?.attachments?.[0]?.id).toBe("file-1");
        expect(storedUnit?.values?.bonusFormula?.expression).toBe("base * 0.1");
        expect(storedUnit?.values?.vacation?.start?.iso).toBe("2024-08-01T00:00:00.000Z");
        expect(storedUnit?.values?.commute).toEqual({ value: 12.5, unit: "km" });
        expect(storedUnit?.values?.avatar?.name).toBe("user");
        expect(storedUnit?.values?.location?.label).toBe("Crystal HQ");
        expect(storedUnit?.values?.manager).toEqual({
            unitId: "manager-123",
            unitType: baseUnitType.id,
        });
        expect(storedUnitType).not.toHaveProperty("values");
    });

    it("invokes the validation handler before persisting data", async () => {
        const crystal = await buildCrystalDB();
        const handler = jest.fn().mockResolvedValue(undefined);
        crystal.setValidationHandler(handler);

        const unitType = await crystal.upsertUnitType(baseUnitType);
        const unit = await crystal.createUnit({
            type: unitType.id,
            values: { name: "Alice", bio: "*hello*", age: 27 },
        });

        expect(handler).toHaveBeenCalledTimes(1);
        const [context] = handler.mock.calls[0];
        expect(context.operation).toBe("create");
        expect(context.unitType.id).toBe(unitType.id);
        expect(context.unit.id).toBe(unit.id);
        expect(context.unit.values.name).toBe("Alice");
        expect(context.unit.values.bio).toBe("*hello*");
    });

    it("rejects creating a unit when the unit type does not exist", async () => {
        const crystal = await buildCrystalDB();

        await expect(
            crystal.createUnit({
                type: "missing-unit-type",
                values: {},
            })
        ).rejects.toThrow("Unit type missing-unit-type not found");
    });
});

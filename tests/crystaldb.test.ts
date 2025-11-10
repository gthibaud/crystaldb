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

import {
    UnitTypeDefinition,
    registerKind,
    type GeoAddressValue,
    type PercentageValue,
    type ReferenceValue,
    type Unit,
} from "@crystaldb/core";
import { CrystalDB, createMongoAdapter } from "@crystaldb/node";

const customJsonKind = "custom:json";

registerKind(
    customJsonKind,
    {
        serialize(value: unknown) {
            if (value === null || value === undefined) {
                return null;
            }
            return JSON.stringify(value);
        },
        deserialize(value: unknown) {
            if (value === null || value === undefined) {
                return null;
            }
            if (typeof value === "string") {
                return JSON.parse(value);
            }
            return value;
        },
    },
    { replace: true }
);

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
            {
                id: "customJson",
                type: customJsonKind,
                documentation: {
                    name: "Custom JSON",
                    description: "Custom kind registered at runtime.",
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
            unitTypeId: baseUnitType.id,
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
                customJson: {
                    payload: { foo: "bar" },
                } as ReturnType<typeof JSON.parse>,
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
        const customJsonValue = unit.values.customJson as { payload: { foo: string } } | null;
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
        expect(customJsonValue?.payload.foo).toBe("bar");

        const db = client.db(databaseName);
        const storedUnit = await db.collection("units").findOne({ businessId: unit.id });
        const storedUnitType = await db
            .collection("unitTypes")
            .findOne({ businessId: baseUnitType.id });

        expect(storedUnit).toBeTruthy();
        expect(storedUnitType).toBeTruthy();
        expect(storedUnit?.id).not.toBe(unit.id);
        expect(storedUnit?.businessId).toBe(unit.id);
        expect(storedUnit?.typeId).toBe(storedUnitType?.id);
        expect(storedUnitType?.id).not.toBe(baseUnitType.id);

        const findTechnicalItemId = (businessId: string): string => {
            const found = storedUnitType?.items?.find(
                (item: { businessId: string; id: string }) => item.businessId === businessId
            );
            if (!found) {
                throw new Error(`Missing stored item for ${businessId}`);
            }
            return found.id;
        };

        const valueOf = (businessId: string) => {
            const technicalId = findTechnicalItemId(businessId);
            return storedUnit?.values?.[technicalId];
        };

        expect(valueOf("name")).toBe("John Doe");
        expect(valueOf("bio")).toBe("# Heading");
        expect(valueOf("age")).toBe(32);
        expect(valueOf("progress")).toBe(4250);
        expect(valueOf("active")).toBe(true);
        expect(valueOf("ageRange")).toEqual({ start: 25, end: 40 });
        expect(valueOf("joinedAt")?.iso).toBe("2024-01-10T12:00:00.000Z");
        expect(valueOf("billingMonth")?.month).toBe("2024-02");
        expect(valueOf("role")).toEqual({ key: "manager", label: "Manager" });
        expect(valueOf("attachments")?.[0]?.id).toBe("file-1");
        expect(valueOf("bonusFormula")?.expression).toBe("base * 0.1");
        expect(valueOf("vacation")?.start?.iso).toBe("2024-08-01T00:00:00.000Z");
        expect(valueOf("commute")).toEqual({ value: 12.5, unit: "km" });
        expect(valueOf("avatar")?.name).toBe("user");
        expect(valueOf("location")?.label).toBe("Crystal HQ");
        expect(valueOf("manager")).toEqual({
            unitId: "manager-123",
            unitType: baseUnitType.id,
        });
        expect(() => JSON.parse(valueOf("customJson") as string)).not.toThrow();

        expect(Object.keys(storedUnit?.values ?? {})).not.toContain("name");
        expect(
            storedUnitType?.items?.every(
                (item: { id: string; businessId: string }) => item.id !== item.businessId
            )
        ).toBe(true);
    });

    it("invokes the validation handler before persisting data", async () => {
        const crystal = await buildCrystalDB();
        const handler = jest.fn().mockResolvedValue(undefined);
        crystal.setValidationHandler(handler);

        const unitType = await crystal.upsertUnitType(baseUnitType);
        const unit = await crystal.createUnit({
            unitTypeId: unitType.id,
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
                unitTypeId: "missing-unit-type",
                values: {},
            })
        ).rejects.toThrow("Unit type missing-unit-type not found");
    });

    it("supports inline unit type definitions for CRUD operations", async () => {
        // Inline unit types never touch the database. They allow tests or applications
        // to configure schemas directly in code while reusing the same serialization pipeline.
        const crystal = await buildCrystalDB();
        const inlineUnitType: UnitTypeDefinition = {
            id: "unitType:inline",
            documentation: {
                name: "Inline",
                description: "Inline configuration without persistence",
            },
            items: [
                {
                    id: "name",
                    type: "string",
                    documentation: {
                        name: "Name",
                        description: "Human readable name",
                    },
                },
                {
                    id: "count",
                    type: "number",
                    documentation: {
                        name: "Count",
                        description: "Numeric counter",
                    },
                },
            ],
        };

        const created = await crystal.createInlineUnit(inlineUnitType, {
            values: {
                name: "Inline User",
                count: 1,
            },
        });

        expect(created.unitTypeId).toBe(inlineUnitType.id);
        expect(created.values.name).toBe("Inline User");
        expect(created.values.count).toBe(1);

        const updated = await crystal.updateInlineUnit(inlineUnitType, created.id, {
            values: { count: 2 },
        });

        expect(updated).not.toBeNull();
        expect(updated?.values.count).toBe(2);
        expect(updated?.values.name).toBe("Inline User");

        const fetched = await crystal.getInlineUnitById(inlineUnitType, created.id);

        expect(fetched).not.toBeNull();
        expect(fetched?.values.name).toBe("Inline User");
        expect(fetched?.values.count).toBe(2);

        const db = client.db(databaseName);
        const storedUnitType = await db
            .collection("unitTypes")
            .findOne({ businessId: inlineUnitType.id });
        const storedUnit = await db.collection("units").findOne({ businessId: created.id });

        expect(storedUnitType).toBeNull();
        expect(storedUnit).not.toBeNull();
        expect(storedUnit?.typeId).toBe(inlineUnitType.id);
        expect(storedUnit?.values?.name).toBe("Inline User");
        expect(storedUnit?.values?.count).toBe(2);

        const listed = await crystal.listUnits(
            inlineUnitType.id,
            {
                filters: {
                    businessId: {
                        value: created.id,
                    },
                },
            },
            { unitType: inlineUnitType }
        );

        expect(listed).toHaveLength(1);
        expect(listed[0]?.id).toBe(created.id);
    });

    it("lists units with filters, sorting, and pagination", async () => {
        const crystal = await buildCrystalDB();
        await crystal.upsertUnitType(baseUnitType);

        await crystal.createUnit({
            id: "user-1",
            unitTypeId: baseUnitType.id,
            values: { name: "Alice" },
        });
        await crystal.createUnit({
            id: "user-2",
            unitTypeId: baseUnitType.id,
            values: { name: "Bob" },
        });
        await crystal.createUnit({
            id: "user-3",
            unitTypeId: baseUnitType.id,
            values: { name: "Charlie" },
        });

        const filtered = await crystal.listUnits(baseUnitType.id, {
            filters: {
                businessId: { value: "user-2" },
            },
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.id).toBe("user-2");

        const ordered = await crystal.listUnits(baseUnitType.id, {
            order: {
                businessId: "desc",
            },
        });

        expect(ordered.map((unit: Unit) => unit.id)).toEqual(["user-3", "user-2", "user-1"]);

        const paginated = await crystal.listUnits(baseUnitType.id, {
            order: {
                businessId: "asc",
            },
            limit: 1,
            offset: 1,
        });

        expect(paginated).toHaveLength(1);
        expect(paginated[0]?.id).toBe("user-2");

        const searched = await crystal.listUnits(baseUnitType.id, {
            search: "user-3",
        });

        expect(searched).toHaveLength(1);
        expect(searched[0]?.id).toBe("user-3");
    });
});

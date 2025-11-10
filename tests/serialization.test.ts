import {
    deserializeCreateInlineUnitInput,
    deserializeCreateUnitInput,
    deserializeUnit,
    deserializeUnitType,
    serializeCreateInlineUnitInput,
    serializeCreateUnitInput,
    serializeUnit,
    serializeUnitType,
    type CreateInlineUnitInput,
    type CreateUnitInput,
    type Unit,
    type UnitTypeDefinition,
} from "@crystaldb/core";

const sampleUnitType: UnitTypeDefinition = {
    id: "unitType:user",
    documentation: {
        name: "User",
        description: "User profile",
    },
    items: [
        {
            id: "name",
            type: "string",
            documentation: {
                name: "Name",
                description: "Full name",
            },
            metadata: {
                required: true,
            },
        },
        {
            id: "age",
            type: "number",
            documentation: {
                name: "Age",
                description: "Age in years",
            },
        },
    ],
};

describe("serialization", () => {
    it("serializes and deserializes unit types", () => {
        const createdAt = new Date("2024-01-01T00:00:00.000Z");
        const updatedAt = new Date("2024-01-02T00:00:00.000Z");

        const serialized = serializeUnitType({
            ...sampleUnitType,
            createdAt,
            updatedAt,
        });

        expect(serialized.createdAt).toBe(createdAt.toISOString());
        expect(serialized.updatedAt).toBe(updatedAt.toISOString());
        expect(serialized.items).toHaveLength(sampleUnitType.items.length);

        const {
            unitType,
            createdAt: parsedCreatedAt,
            updatedAt: parsedUpdatedAt,
        } = deserializeUnitType(serialized);
        expect(unitType).toEqual(sampleUnitType);
        expect(parsedCreatedAt?.toISOString()).toBe(createdAt.toISOString());
        expect(parsedUpdatedAt?.toISOString()).toBe(updatedAt.toISOString());
    });

    it("throws when unit type payload is malformed", () => {
        expect(() => deserializeUnitType({})).toThrow("Unit type id must be a non-empty string");
        expect(() =>
            deserializeUnitType({
                id: "test",
                documentation: { name: "Name", description: "Desc" },
                items: [{}],
            })
        ).toThrow(/items\[0]/);
    });

    it("serializes and deserializes units with validation", () => {
        const createdAt = new Date("2024-03-01T10:00:00.000Z");
        const updatedAt = new Date("2024-03-02T10:00:00.000Z");

        const unit: Unit = {
            id: "user-1",
            unitTypeId: sampleUnitType.id,
            values: {
                name: "Alice",
                age: 32,
            },
            metadata: {
                createdBy: "system",
            },
            createdAt,
            updatedAt,
        };

        const serialized = serializeUnit(unit, sampleUnitType);

        expect(serialized.createdAt).toBe(createdAt.toISOString());
        expect(serialized.values.name).toBe("Alice");

        const roundtrip = deserializeUnit(serialized, sampleUnitType);
        expect(roundtrip).toMatchObject({
            id: unit.id,
            unitTypeId: unit.unitTypeId,
            values: unit.values,
            metadata: unit.metadata,
        });
        expect(roundtrip.createdAt.toISOString()).toBe(createdAt.toISOString());
        expect(roundtrip.updatedAt.toISOString()).toBe(updatedAt.toISOString());
    });

    it("rejects units with unknown fields", () => {
        const serialized = {
            id: "user-1",
            unitTypeId: sampleUnitType.id,
            values: {
                name: "Alice",
                age: 32,
                extra: "oops",
            },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
        };

        expect(() => deserializeUnit(serialized, sampleUnitType)).toThrow(
            'Unknown value "extra" for unit type "unitType:user"'
        );
    });

    it("rejects units missing required values", () => {
        const serialized = {
            id: "user-1",
            unitTypeId: sampleUnitType.id,
            values: {
                age: 30,
            },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
        };

        expect(() => deserializeUnit(serialized, sampleUnitType)).toThrow(
            'Missing required value for data item "name"'
        );
    });

    it("rejects units with mismatching unit type ids", () => {
        const serialized = {
            id: "user-1",
            unitTypeId: "unitType:other",
            values: {
                name: "Alice",
            },
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
        };

        expect(() => deserializeUnit(serialized, sampleUnitType)).toThrow(
            /references mismatched unit type/
        );
    });

    it("serializes create unit payloads without enforcing ids", () => {
        const input: CreateUnitInput = {
            unitTypeId: sampleUnitType.id,
            values: {
                name: "Alice",
                age: 30,
            },
        };

        const serialized = serializeCreateUnitInput(input, sampleUnitType);
        expect(serialized).toMatchObject({
            unitTypeId: sampleUnitType.id,
            values: {
                name: "Alice",
                age: 30,
            },
        });
        expect(serialized.id).toBeUndefined();

        const deserialized = deserializeCreateUnitInput(serialized, sampleUnitType);
        expect(deserialized).toEqual({
            unitTypeId: sampleUnitType.id,
            values: {
                name: "Alice",
                age: 30,
            },
            metadata: undefined,
            id: undefined,
        });
    });

    it("serializes create inline unit payloads and preserves optional id", () => {
        const input: CreateInlineUnitInput = {
            id: "custom-id",
            values: {
                name: "Bob",
            },
            metadata: {
                createdBy: "author",
            },
        };

        const serialized = serializeCreateInlineUnitInput(input, sampleUnitType);
        expect(serialized).toMatchObject({
            id: "custom-id",
            metadata: {
                createdBy: "author",
            },
        });
        expect(serialized.values).toEqual({
            name: "Bob",
        });

        const deserialized = deserializeCreateInlineUnitInput(serialized, sampleUnitType);
        expect(deserialized).toEqual({
            id: "custom-id",
            values: {
                name: "Bob",
                age: null,
            },
            metadata: {
                createdBy: "author",
            },
        });
    });

    it("validates mismatching unit type on create payload deserialization", () => {
        expect(() =>
            deserializeCreateUnitInput(
                {
                    unitTypeId: "other",
                    values: {
                        name: "Charlie",
                    },
                },
                sampleUnitType
            )
        ).toThrow(/targets "other"/);
    });
});

import {
    CreateInlineUnitInput,
    DataItemMetadataConfig,
    DataItemStatusConfig,
    DocumentationBlock,
    Unit,
    UnitMetadata,
    UnitTypeDefinition,
    UnitTypeMetadataConfig,
    UnitTypeStatusConfig,
    UnitTypeKind,
    StoredUnitType,
} from "./types";
import { deserializeUnitValues, serializeUnitValues } from "./kinds";

export interface SerializedUnitType extends UnitTypeDefinition {
    createdAt?: string;
    updatedAt?: string;
}

export interface SerializedUnit {
    id: string;
    unitTypeId: string;
    values: Record<string, unknown>;
    metadata?: UnitMetadata;
    createdAt?: string;
    updatedAt?: string;
}

export interface DeserializedUnitTypeResult {
    unitType: UnitTypeDefinition;
    createdAt?: Date;
    updatedAt?: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
    if (!isRecord(value)) {
        throw new Error(message);
    }
}

function assertArray(value: unknown, message: string): asserts value is unknown[] {
    if (!Array.isArray(value)) {
        throw new Error(message);
    }
}

const isLocalizedString = (value: unknown): boolean => {
    if (typeof value === "string") {
        return true;
    }

    if (!isRecord(value)) {
        return false;
    }

    return Object.values(value).every((entry) => typeof entry === "string");
};

const validateDocumentation = (docInput: unknown, context: string): DocumentationBlock => {
    assertRecord(docInput, `${context} must be an object`);
    const doc = docInput as Record<string, unknown>;

    const name = doc.name;
    const description = doc.description;

    if (!isLocalizedString(name)) {
        throw new Error(`${context}.name must be a string or a record of strings`);
    }
    if (!isLocalizedString(description)) {
        throw new Error(`${context}.description must be a string or a record of strings`);
    }
    if (doc.icon !== undefined && typeof doc.icon !== "string") {
        throw new Error(`${context}.icon must be a string when provided`);
    }
    if (doc.tags !== undefined) {
        const tags = doc.tags as unknown[];
        if (!Array.isArray(tags) || !tags.every((tag: unknown) => typeof tag === "string")) {
            throw new Error(`${context}.tags must be an array of strings`);
        }
    }
    if (doc.links !== undefined) {
        assertArray(doc.links, `${context}.links must be an array`);
        (doc.links as unknown[]).forEach((link, index) => {
            const linkContext = `${context}.links[${index}]`;
            assertRecord(link, `${linkContext} must be an object`);
            const linkRecord = link as Record<string, unknown>;
            if (!isLocalizedString(linkRecord.label)) {
                throw new Error(`${linkContext}.label must be a string or a record of strings`);
            }
            if (typeof linkRecord.url !== "string") {
                throw new Error(`${linkContext}.url must be a string`);
            }
        });
    }
    if (doc.examples !== undefined) {
        const examples = doc.examples as unknown[];
        if (!Array.isArray(examples) || !examples.every((entry) => isLocalizedString(entry))) {
            throw new Error(`${context}.examples must be an array of localized strings`);
        }
    }

    const normalized: DocumentationBlock = {
        name: doc.name as DocumentationBlock["name"],
        description: doc.description as DocumentationBlock["description"],
    };

    if (doc.icon !== undefined) {
        normalized.icon = doc.icon as string;
    }
    if (doc.tags !== undefined) {
        normalized.tags = doc.tags as string[];
    }
    if (doc.links !== undefined) {
        const links = (doc.links as Array<Record<string, unknown>>).map((link) => ({
            label: link.label as DocumentationBlock["name"],
            url: link.url as string,
        }));
        normalized.links = links as DocumentationBlock["links"];
    }
    if (doc.examples !== undefined) {
        normalized.examples = doc.examples as DocumentationBlock["examples"];
    }

    return normalized;
};

const validateDataItem = (
    itemInput: unknown,
    index: number
): {
    id: string;
    type: UnitTypeKind;
    documentation: DocumentationBlock;
    metadata?: DataItemMetadataConfig;
    status?: DataItemStatusConfig;
} => {
    const context = `items[${index}]`;
    assertRecord(itemInput, `${context} must be an object`);
    const item = itemInput as Record<string, unknown>;

    const id = item.id;
    if (typeof id !== "string" || id.length === 0) {
        throw new Error(`${context}.id must be a non-empty string`);
    }

    const type = item.type;
    if (typeof type !== "string" || type.length === 0) {
        throw new Error(`${context}.type must be a non-empty string`);
    }

    const documentation = validateDocumentation(item.documentation, `${context}.documentation`);

    const metadataCandidate = item.metadata;
    if (metadataCandidate !== undefined && !isRecord(metadataCandidate)) {
        throw new Error(`${context}.metadata must be an object when provided`);
    }

    const statusCandidate = item.status;
    if (statusCandidate !== undefined && !isRecord(statusCandidate)) {
        throw new Error(`${context}.status must be an object when provided`);
    }

    return {
        id,
        type: type as UnitTypeKind,
        documentation,
        metadata: metadataCandidate as DataItemMetadataConfig | undefined,
        status: statusCandidate as DataItemStatusConfig | undefined,
    };
};

const coerceDate = (value: unknown, context: string): Date | undefined => {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new Error(`${context} must be an ISO string when provided`);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${context} must be a valid ISO date string`);
    }
    return date;
};

const cloneJson = <T>(value: T): T => {
    if (value === undefined) {
        return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
};

export const serializeUnitType = (
    unitType: UnitTypeDefinition | StoredUnitType
): SerializedUnitType => {
    const items = unitType.items.map((item) => ({
        id: item.id,
        type: item.type,
        documentation: cloneJson(item.documentation),
        metadata: cloneJson(item.metadata),
        status: cloneJson(item.status),
    }));

    const serialized: SerializedUnitType = {
        id: unitType.id,
        documentation: cloneJson(unitType.documentation),
        items,
        metadata: cloneJson(unitType.metadata),
        status: cloneJson(unitType.status),
        createdAt:
            "createdAt" in unitType && unitType.createdAt
                ? unitType.createdAt.toISOString()
                : undefined,
        updatedAt:
            "updatedAt" in unitType && unitType.updatedAt
                ? unitType.updatedAt.toISOString()
                : undefined,
    };

    return serialized;
};

export const deserializeUnitType = (payload: unknown): DeserializedUnitTypeResult => {
    assertRecord(payload, "Unit type payload must be an object");
    const record = payload as Record<string, unknown>;

    if (typeof record.id !== "string" || record.id.length === 0) {
        throw new Error("Unit type id must be a non-empty string");
    }

    const documentation = validateDocumentation(record.documentation, "documentation");

    const itemsRaw = record.items;
    if (!Array.isArray(itemsRaw)) {
        throw new Error("Unit type items must be an array");
    }

    const items = (itemsRaw as unknown[]).map((item: unknown, index: number) =>
        validateDataItem(item, index)
    );

    if (record.metadata !== undefined && !isRecord(record.metadata)) {
        throw new Error("Unit type metadata must be an object when provided");
    }

    if (record.status !== undefined && !isRecord(record.status)) {
        throw new Error("Unit type status must be an object when provided");
    }

    const unitType: UnitTypeDefinition = {
        id: record.id as string,
        documentation,
        items,
        metadata: cloneJson(record.metadata as UnitTypeMetadataConfig | undefined),
        status: cloneJson(record.status as UnitTypeStatusConfig | undefined),
    };

    return {
        unitType,
        createdAt: coerceDate(record.createdAt, "createdAt"),
        updatedAt: coerceDate(record.updatedAt, "updatedAt"),
    };
};

export const serializeUnit = (unit: Unit, unitType: UnitTypeDefinition): SerializedUnit => {
    if (unit.unitTypeId !== unitType.id) {
        throw new Error(`Unit ${unit.id} does not belong to unit type ${unitType.id}`);
    }

    const values = serializeUnitValues(unitType, unit.values);

    return {
        id: unit.id,
        unitTypeId: unit.unitTypeId,
        values: cloneJson(values),
        metadata: cloneJson(unit.metadata),
        createdAt: unit.createdAt.toISOString(),
        updatedAt: unit.updatedAt.toISOString(),
    };
};

const validateUnitValues = (unitType: UnitTypeDefinition, values: Record<string, unknown>) => {
    const itemIds = new Set(unitType.items.map((item) => item.id));

    for (const key of Object.keys(values)) {
        if (!itemIds.has(key)) {
            throw new Error(`Unknown value "${key}" for unit type "${unitType.id}"`);
        }
    }

    const result = deserializeUnitValues(unitType, values);

    for (const item of unitType.items) {
        const rawValue = values[item.id];
        const isMissing = rawValue === undefined || rawValue === null;
        if (item.metadata?.required && isMissing) {
            throw new Error(`Missing required value for data item "${item.id}"`);
        }

        const deserialized = result[item.id];
        if (item.metadata?.required && (deserialized === null || deserialized === undefined)) {
            throw new Error(`Required value "${item.id}" resolved to null or undefined`);
        }
    }

    return result;
};

const validateUnitMetadata = (
    unitType: UnitTypeDefinition,
    metadata: UnitMetadata | undefined
): UnitMetadata | undefined => {
    if (metadata === undefined) {
        return undefined;
    }

    if (!isRecord(metadata)) {
        throw new Error("Unit metadata must be an object");
    }

    if (metadata.itemStatuses && isRecord(metadata.itemStatuses)) {
        const itemIds = new Set(unitType.items.map((item) => item.id));
        for (const key of Object.keys(metadata.itemStatuses)) {
            if (!itemIds.has(key)) {
                throw new Error(`Metadata references unknown data item "${key}"`);
            }
        }
    }

    return cloneJson(metadata);
};

export const deserializeUnit = (payload: unknown, unitType: UnitTypeDefinition): Unit => {
    assertRecord(payload, "Unit payload must be an object");
    const record = payload as Record<string, unknown>;

    if (typeof record.id !== "string" || record.id.length === 0) {
        throw new Error("Unit id must be a non-empty string");
    }

    if (typeof record.unitTypeId !== "string" || record.unitTypeId.length === 0) {
        throw new Error("Unit unitTypeId must be a non-empty string");
    }

    if (record.unitTypeId !== unitType.id) {
        throw new Error(
            `Unit ${record.id} references mismatched unit type "${record.unitTypeId}", expected "${unitType.id}"`
        );
    }

    assertRecord(record.values, "Unit values must be an object");

    const valuesRecord = record.values as Record<string, unknown>;
    const values = validateUnitValues(unitType, valuesRecord);
    const metadata = validateUnitMetadata(unitType, record.metadata as UnitMetadata | undefined);

    const createdAt = coerceDate(record.createdAt, "createdAt") ?? new Date();
    const updatedAt = coerceDate(record.updatedAt, "updatedAt") ?? createdAt;

    return {
        id: record.id as string,
        unitTypeId: unitType.id,
        values,
        metadata,
        createdAt,
        updatedAt,
    };
};

export const deserializeInlineUnit = (
    payload: unknown,
    unitType: UnitTypeDefinition
): CreateInlineUnitInput => {
    const unit = deserializeUnit(payload, unitType);
    return {
        id: unit.id,
        values: unit.values,
        metadata: unit.metadata,
    };
};

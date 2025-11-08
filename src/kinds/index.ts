import {
    BUILT_IN_UNIT_TYPE_KINDS,
    UnitTypeDefinition,
    UnitTypeKind,
    UnitValue,
    UnitValues,
    StoredUnitType,
    SerializationContext,
} from "../types";
import * as stringKind from "./string";
import * as markdownKind from "./markdown";
import * as numberKind from "./number";
import * as numberRangeKind from "./numberRange";
import * as booleanKind from "./boolean";
import * as dateKind from "./date";
import * as monthKind from "./month";
import * as enumKind from "./enum";
import * as filesKind from "./files";
import * as formulaKind from "./formula";
import * as dateRangeKind from "./dateRange";
import * as distanceKind from "./distance";
import * as iconKind from "./icon";
import * as percentageKind from "./percentage";
import * as geoAddressKind from "./geoAddress";
import * as referenceKind from "./reference";

export interface KindHandler {
    serialize(value: unknown): unknown;
    deserialize(value: unknown): unknown;
}

const kindRegistry = new Map<string, KindHandler>();

export const registerKind = (
    kind: UnitTypeKind,
    handler: KindHandler,
    options: { replace?: boolean } = {}
): void => {
    if (!options.replace && kindRegistry.has(kind)) {
        throw new Error(`Kind "${kind}" is already registered`);
    }
    kindRegistry.set(kind, handler);
};

export const getRegisteredKind = (kind: UnitTypeKind): KindHandler | undefined => {
    return kindRegistry.get(kind);
};

const builtIns: Array<KindHandler & { kind: string }> = [
    stringKind,
    markdownKind,
    numberKind,
    numberRangeKind,
    booleanKind,
    dateKind,
    monthKind,
    enumKind,
    filesKind,
    formulaKind,
    dateRangeKind,
    distanceKind,
    iconKind,
    percentageKind,
    geoAddressKind,
    referenceKind,
];

BUILT_IN_UNIT_TYPE_KINDS.forEach((kindName) => {
    const module = builtIns.find((handler) => handler.kind === kindName);
    if (!module) {
        throw new Error(`Missing module for built-in kind "${kindName}"`);
    }
    registerKind(kindName, module, { replace: true });
});

const buildItemsMap = (unitType: UnitTypeDefinition | StoredUnitType) => {
    return new Map(unitType.items.map((item) => [item.id, item]));
};

export const serializeValue = (kind: UnitTypeKind, value: UnitValue | undefined): unknown => {
    const handler = getRegisteredKind(kind);
    if (!handler) {
        throw new Error(`No serializer configured for kind "${kind}"`);
    }
    return handler.serialize(value ?? null);
};

export const deserializeValue = (kind: UnitTypeKind, value: unknown): UnitValue => {
    const handler = getRegisteredKind(kind);
    if (!handler) {
        throw new Error(`No deserializer configured for kind "${kind}"`);
    }
    return handler.deserialize(value) as UnitValue;
};

export const serializeUnitValues = (
    unitType: UnitTypeDefinition | StoredUnitType,
    values: UnitValues | undefined,
    context?: SerializationContext
): Record<string, unknown> => {
    const items = buildItemsMap(unitType);
    const baseValues: Record<string, unknown> = {
        ...(context?.existingValues ?? {}),
    };

    if (!values) {
        return { ...baseValues };
    }

    for (const key of Object.keys(values)) {
        const item = items.get(key);
        if (!item) {
            throw new Error(`Unknown data item "${key}" for unit type "${unitType.id}"`);
        }

        const serialized = serializeValue(item.type, values[key]);
        if (serialized === null || serialized === undefined) {
            delete baseValues[key];
        } else {
            baseValues[key] = serialized;
        }
    }

    return baseValues;
};

export const deserializeUnitValues = (
    unitType: UnitTypeDefinition | StoredUnitType,
    storedValues: Record<string, unknown> | undefined
): UnitValues => {
    const items = buildItemsMap(unitType);
    const result: UnitValues = {};

    for (const [key, item] of items.entries()) {
        const serializedValue = storedValues ? storedValues[key] : undefined;
        result[key] = deserializeValue(item.type, serializedValue ?? null);
    }

    return result;
};

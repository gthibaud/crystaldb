import type { EnumValue } from "./types";

export const kind = "enum" as const;

const normalize = (value: EnumValue): EnumValue => {
    if (!value.key || typeof value.key !== "string") {
        throw new TypeError("Enum value requires a string 'key'");
    }

    const normalized: EnumValue = {
        key: value.key,
    };

    if (value.label) {
        normalized.label = value.label;
    }
    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): EnumValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ key: value });
    }

    if (typeof value === "object" && value !== null && "key" in value) {
        return normalize(value as EnumValue);
    }

    throw new TypeError("Enum value must be a string or { key } object");
};

export const deserialize = (value: unknown): EnumValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ key: value });
    }

    if (typeof value === "object" && value !== null && "key" in value) {
        return normalize(value as EnumValue);
    }

    throw new TypeError("Stored enum value must be a string or { key } object");
};

import type { IconValue } from "./types";

export const kind = "icon" as const;

const normalize = (value: IconValue): IconValue => {
    if (!value.name || typeof value.name !== "string") {
        throw new TypeError("Icon value requires a string 'name'");
    }

    const normalized: IconValue = {
        name: value.name,
    };

    if (value.color) {
        normalized.color = value.color;
    }
    if (value.library) {
        normalized.library = value.library;
    }
    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): IconValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ name: value });
    }

    if (typeof value === "object" && value !== null && "name" in value) {
        return normalize(value as IconValue);
    }

    throw new TypeError("Icon value must be a string or { name } object");
};

export const deserialize = (value: unknown): IconValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ name: value });
    }

    if (typeof value === "object" && value !== null && "name" in value) {
        return normalize(value as IconValue);
    }

    throw new TypeError("Stored icon must be a string or { name } object");
};

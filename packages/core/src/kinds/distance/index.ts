import { DistanceValue } from "./types";

export const kind = "distance" as const;

const ensureNumber = (value: unknown, label: string): number => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number`);
    }
    return value;
};

const normalize = (value: DistanceValue): DistanceValue => {
    const normalized: DistanceValue = {
        value: ensureNumber(value.value, "distance.value"),
    };

    if (value.unit) {
        normalized.unit = value.unit;
    }
    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): DistanceValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("Distance value must be an object with a numeric 'value'");
    }

    return normalize(value as DistanceValue);
};

export const deserialize = (value: unknown): DistanceValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("Stored distance must be an object");
    }

    return normalize(value as DistanceValue);
};

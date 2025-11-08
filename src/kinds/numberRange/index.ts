import type { NumberRangeValue } from "./types";

export const kind = "numberRange" as const;

const ensureNumber = (value: unknown, label: string): number => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number, received ${value}`);
    }
    return value;
};

const sanitize = (value: NumberRangeValue): NumberRangeValue => {
    const start = ensureNumber(value.start, "numberRange.start");
    const end = ensureNumber(value.end, "numberRange.end");

    if (start > end) {
        throw new RangeError("numberRange.start must be <= numberRange.end");
    }

    const normalized: NumberRangeValue = {
        start,
        end,
    };

    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): NumberRangeValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("NumberRange must be an object with start/end");
    }

    return sanitize(value as NumberRangeValue);
};

export const deserialize = (value: unknown): NumberRangeValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Stored number range must be an object");
    }

    return sanitize(value as NumberRangeValue);
};

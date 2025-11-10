import { DateValue } from "./types";

export const kind = "date" as const;

const ensureIso = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError(`Invalid date value "${value}"`);
    }
    return date.toISOString();
};

const normalize = (value: DateValue): DateValue => {
    return {
        iso: ensureIso(value.iso),
        metadata: value.metadata,
    };
};

export const serialize = (value: unknown): DateValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return { iso: value.toISOString() };
    }

    if (typeof value === "string") {
        return { iso: ensureIso(value) };
    }

    if (typeof value === "object" && value !== null && "iso" in value) {
        return normalize(value as DateValue);
    }

    throw new TypeError("Date value must be a Date, ISO string, or { iso } object");
};

export const deserialize = (value: unknown): DateValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return { iso: ensureIso(value) };
    }

    if (typeof value === "object" && value !== null && "iso" in value) {
        return normalize(value as DateValue);
    }

    throw new TypeError("Stored date must be an ISO string or { iso } object");
};

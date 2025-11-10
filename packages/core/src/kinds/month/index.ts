import type { MonthValue } from "./types";

export const kind = "month" as const;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const normalize = (value: MonthValue): MonthValue => {
    if (!MONTH_RE.test(value.month)) {
        throw new TypeError(`Month value must match YYYY-MM, received "${value.month}"`);
    }
    return {
        month: value.month,
        metadata: value.metadata,
    };
};

export const serialize = (value: unknown): MonthValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ month: value });
    }

    if (typeof value === "object" && value !== null && "month" in value) {
        return normalize(value as MonthValue);
    }

    throw new TypeError('Month value must be a string or { month: "YYYY-MM" } object');
};

export const deserialize = (value: unknown): MonthValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return normalize({ month: value });
    }

    if (typeof value === "object" && value !== null && "month" in value) {
        return normalize(value as MonthValue);
    }

    throw new TypeError("Stored month must be a string or { month } object");
};

import { serialize as serializeDate } from "../date";
import type { DateRangeValue } from "./types";

export const kind = "dateRange" as const;

const normalize = (value: DateRangeValue): DateRangeValue => {
    const start = serializeDate(value.start);
    const end = serializeDate(value.end);

    if (!start || !end) {
        throw new TypeError("Date range requires both start and end dates");
    }

    if (start.iso > end.iso) {
        throw new RangeError("dateRange.start must be <= dateRange.end");
    }

    const normalized: DateRangeValue = {
        start,
        end,
    };

    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): DateRangeValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("DateRange must be an object with start/end");
    }

    return normalize(value as DateRangeValue);
};

export const deserialize = (value: unknown): DateRangeValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new TypeError("Stored date range must be an object");
    }

    return normalize(value as DateRangeValue);
};

export const kind = "number" as const;

export type NumberValue = number | null;

const ensureNumber = (value: unknown): number => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`Number value must be a finite number, received ${value}`);
    }
    return value;
};

export const serialize = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    return ensureNumber(value);
};

export const deserialize = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    return ensureNumber(value);
};

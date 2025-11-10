export const kind = "boolean" as const;

export type BooleanValue = boolean | null;

export const serialize = (value: unknown): boolean | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (value === "true" || value === "false") {
        return value === "true";
    }

    throw new TypeError(`Boolean value must be true/false, received ${typeof value}`);
};

export const deserialize = (value: unknown): boolean | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "boolean") {
        throw new TypeError(`Stored boolean must be a boolean, received ${typeof value}`);
    }

    return value;
};

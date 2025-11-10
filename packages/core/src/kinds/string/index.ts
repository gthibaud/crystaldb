export const kind = "string" as const;

export type StringValue = string | null;

export const serialize = (value: unknown): string | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    return String(value);
};

export const deserialize = (value: unknown): string | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return value;
    }

    return String(value);
};

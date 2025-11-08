export const kind = "markdown" as const;

export type MarkdownValue = string | null;

export const serialize = (value: unknown): string | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "string") {
        throw new TypeError(`Markdown value must be a string, received ${typeof value}`);
    }

    return value;
};

export const deserialize = (value: unknown): string | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "string") {
        throw new TypeError(`Markdown value must be a string, received ${typeof value}`);
    }

    return value;
};

import type { FileResource, FilesValue } from "./types";

export const kind = "files" as const;

const ensureFile = (value: FileResource): FileResource => {
    if (!value.id || typeof value.id !== "string") {
        throw new TypeError("File resource requires a string 'id'");
    }

    const normalized: FileResource = {
        id: value.id,
    };

    if (value.name) {
        normalized.name = value.name;
    }
    if (value.url) {
        normalized.url = value.url;
    }
    if (value.size) {
        normalized.size = value.size;
    }
    if (value.mimeType) {
        normalized.mimeType = value.mimeType;
    }
    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

const coerceArray = (value: unknown): FileResource[] => {
    if (!Array.isArray(value)) {
        throw new TypeError("Files value must be an array of file descriptors");
    }

    return value.map((entry) => {
        if (typeof entry !== "object" || entry === null) {
            throw new TypeError("File entry must be an object");
        }
        return ensureFile(entry as FileResource);
    });
};

export const serialize = (value: unknown): FilesValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    return coerceArray(value);
};

export const deserialize = (value: unknown): FilesValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    return coerceArray(value);
};

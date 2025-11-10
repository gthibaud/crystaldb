import type { ReferenceValue } from "./types";

export const kind = "reference" as const;

const sanitizeReference = (value: ReferenceValue): ReferenceValue => {
    if (!value.unitId) {
        throw new TypeError('Reference value requires a "unitId" field');
    }
    if (!value.unitType) {
        throw new TypeError('Reference value requires a "unitType" field');
    }

    const sanitized: ReferenceValue = {
        unitId: String(value.unitId),
        unitType: String(value.unitType),
    };

    if (value.metadata) {
        sanitized.metadata = value.metadata;
    }

    return sanitized;
};

export const serialize = (value: unknown): ReferenceValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Reference value must be an object");
    }

    return sanitizeReference(value as ReferenceValue);
};

export const deserialize = (value: unknown): ReferenceValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Stored reference value must be an object");
    }

    return sanitizeReference(value as ReferenceValue);
};

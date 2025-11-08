import type { FormulaValue } from "./types";

export const kind = "formula" as const;

const normalize = (value: FormulaValue): FormulaValue => {
    if (!value.expression || typeof value.expression !== "string") {
        throw new TypeError("Formula requires a string 'expression'");
    }

    const normalized: FormulaValue = {
        expression: value.expression,
    };

    if ("result" in value) {
        normalized.result = value.result;
    }
    if (value.metadata) {
        normalized.metadata = value.metadata;
    }

    return normalized;
};

export const serialize = (value: unknown): FormulaValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return { expression: value };
    }

    if (typeof value === "object" && value !== null && "expression" in value) {
        return normalize(value as FormulaValue);
    }

    throw new TypeError("Formula value must be a string or { expression } object");
};

export const deserialize = (value: unknown): FormulaValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        return { expression: value };
    }

    if (typeof value === "object" && value !== null && "expression" in value) {
        return normalize(value as FormulaValue);
    }

    throw new TypeError("Stored formula must be a string or { expression } object");
};

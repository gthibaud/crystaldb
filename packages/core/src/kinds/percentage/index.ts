import type { PercentageValue } from "./types";

export const kind = "percentage" as const;

const BASIS_POINTS = 100;

const coercePercentageValue = (value: unknown): PercentageValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "number") {
        return { value };
    }

    if (typeof value === "object" && value !== null && "value" in value) {
        const typedValue = (value as { value: unknown }).value;
        if (typeof typedValue !== "number") {
            throw new TypeError(`Percentage value must be numeric, received ${typeof typedValue}`);
        }
        return { value: typedValue };
    }

    throw new TypeError(
        'Percentage value must be a number or an object with a numeric "value" property'
    );
};

export const serialize = (value: unknown): number | null => {
    const coerced = coercePercentageValue(value);
    if (coerced === null) {
        return null;
    }

    if (coerced.value < 0 || coerced.value > 100) {
        throw new RangeError(
            `Percentage value must be between 0 and 100, received ${coerced.value}`
        );
    }

    return Math.round(coerced.value * BASIS_POINTS);
};

export const deserialize = (value: unknown): PercentageValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "number") {
        throw new TypeError(
            `Stored percentage must be a number of basis points, received ${typeof value}`
        );
    }

    return {
        value: value / BASIS_POINTS,
    };
};

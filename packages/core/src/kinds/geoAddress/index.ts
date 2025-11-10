import { GeoAddressValue } from "./types";

export const kind = "geoAddress" as const;

const ensureNumber = (value: unknown, name: string): number => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${name} must be a finite number`);
    }
    return value;
};

const sanitizeGeoAddress = (value: GeoAddressValue): GeoAddressValue => {
    const sanitized: GeoAddressValue = {};

    if (value.label) {
        sanitized.label = value.label;
    }
    if (value.street) {
        sanitized.street = value.street;
    }
    if (value.city) {
        sanitized.city = value.city;
    }
    if (value.postalCode) {
        sanitized.postalCode = value.postalCode;
    }
    if (value.region) {
        sanitized.region = value.region;
    }
    if (value.country) {
        sanitized.country = value.country;
    }
    if (value.metadata) {
        sanitized.metadata = value.metadata;
    }
    if (value.coordinates) {
        sanitized.coordinates = {
            latitude: ensureNumber(value.coordinates.latitude, "GeoAddress latitude"),
            longitude: ensureNumber(value.coordinates.longitude, "GeoAddress longitude"),
        };
    }

    return sanitized;
};

export const serialize = (value: unknown): GeoAddressValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("GeoAddress value must be an object");
    }

    return sanitizeGeoAddress(value as GeoAddressValue);
};

export const deserialize = (value: unknown): GeoAddressValue | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Stored geoAddress value must be an object");
    }

    return sanitizeGeoAddress(value as GeoAddressValue);
};

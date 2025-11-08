import type { Value } from "../../types";

export interface GeoAddressCoordinates {
    latitude: number;
    longitude: number;
}

export interface GeoAddressValue extends Value {
    label?: string;
    coordinates?: GeoAddressCoordinates;
    street?: string;
    city?: string;
    postalCode?: string;
    region?: string;
    country?: string;
}

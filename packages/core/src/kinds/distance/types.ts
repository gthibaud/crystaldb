import type { Value } from "../../types";

export interface DistanceValue extends Value {
    value: number;
    unit?: string;
}

export interface DistanceValueMetadata {
    transportationMode?: TransportationMode;
}

export enum TransportationMode {
    car = "car",
    truck = "truck",
    boat = "boat",
    plane = "plane",
    train = "train",
    other = "other",
}

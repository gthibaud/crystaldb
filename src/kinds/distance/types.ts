import type { Value } from "../../types";

export interface DistanceValue extends Value {
    value: number;
    unit?: string;
}

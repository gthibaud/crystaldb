import type { Value } from "../../types";

export interface ReferenceValue extends Value {
    unitId: string;
    unitType: string;
}

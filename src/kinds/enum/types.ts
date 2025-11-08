import type { Value } from "../../types";

export interface EnumValue extends Value {
    key: string;
    label?: string;
}

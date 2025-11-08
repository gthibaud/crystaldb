import type { Value } from "../../types";

export interface IconValue extends Value {
    name: string;
    color?: string;
    library?: string;
}

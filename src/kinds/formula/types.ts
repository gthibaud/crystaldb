import type { Value } from "../../types";

export interface FormulaValue extends Value {
    expression: string;
    result?: unknown;
}

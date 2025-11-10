import type { Value } from "../../types";

export interface ReferenceValue extends Value {
    unitId: string;
    unitType: string;
}

export interface ReferenceValueMetadata {
    referenceId?: string; // ? referenced unit type id ?
    usageMode?: ReferenceUsageMode; // Metadata to check with the team, I don't know if we need this.
    selectionMode?: ReferenceSelectionMode; // Metadata to check with the team, I don't know if we need this.
}

export enum ReferenceUsageMode {
    single = "single",
    singleByUnitType = "singleByUnitType",
    bulk = "bulk",
}

export enum ReferenceSelectionMode {
    single = "single",
    bulk = "bulk",
}

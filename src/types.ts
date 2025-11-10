import type { DateValue } from "./kinds/date/types";
import type { DateRangeValue } from "./kinds/dateRange/types";
import type { DistanceValue, DistanceValueMetadata } from "./kinds/distance/types";
import type { EnumValue, EnumValueMetadata } from "./kinds/enum/types";
import type { FilesValue, FilesValueMetadata } from "./kinds/files/types";
import type { FormulaValue } from "./kinds/formula/types";
import type { GeoAddressValue } from "./kinds/geoAddress/types";
import type { IconValue } from "./kinds/icon/types";
import type { MonthValue } from "./kinds/month/types";
import type { NumberRangeValue } from "./kinds/numberRange/types";
import type { PercentageValue } from "./kinds/percentage/types";
import type { ReferenceValue, ReferenceValueMetadata } from "./kinds/reference/types";

export type { DateValue } from "./kinds/date/types";
export type { DateRangeValue } from "./kinds/dateRange/types";
export type { DistanceValue } from "./kinds/distance/types";
export type { EnumValue } from "./kinds/enum/types";
export type { FileResource, FilesValue } from "./kinds/files/types";
export type { FormulaValue } from "./kinds/formula/types";
export type { GeoAddressCoordinates, GeoAddressValue } from "./kinds/geoAddress/types";
export type { IconValue } from "./kinds/icon/types";
export type { MonthValue } from "./kinds/month/types";
export type { NumberRangeValue } from "./kinds/numberRange/types";
export type { PercentageValue } from "./kinds/percentage/types";
export type { ReferenceValue } from "./kinds/reference/types";
export { BUILT_IN_UNIT_TYPE_KINDS };

export interface Value {
    metadata?: StatusAwareMetadata;
}

const BUILT_IN_UNIT_TYPE_KINDS = [
    "string",
    "markdown",
    "number",
    "numberRange",
    "boolean",
    "date",
    "month",
    "enum",
    "files",
    "formula",
    "dateRange",
    "distance",
    "icon",
    "percentage",
    "geoAddress",
    "reference",
] as const;

export type BuiltInUnitTypeKind = (typeof BUILT_IN_UNIT_TYPE_KINDS)[number];

export type UnitTypeKind = BuiltInUnitTypeKind | (string & {});

export interface ValueKindMetadata
    extends EnumValueMetadata,
    ReferenceValueMetadata,
    DistanceValueMetadata,
    FilesValueMetadata,
    Record<string, unknown> { }

export interface DataItemStatusConfig extends Record<string, unknown> {
    rules: "incomplete" | "valid" | "invalid" | "warning";
    edition: "system" | "user";
}

export interface DataItemMetadataConfig extends ValueKindMetadata {
    required?: boolean;
    unique?: boolean;
    indexed?: boolean;
    rulesIds?: string[];
    calculation?: {
        methodId: string;
        parameters: string[];
    };
    createdAt?: boolean;
    updatedAt?: boolean;
    createdBy?: boolean;
    updatedBy?: boolean;
    // To discuss with the team:
    // - immutable?: boolean;
    // - status?: DataItemStatusConfig;
    // - retentionDays?: number;
}

export interface DataItemType<TKind extends UnitTypeKind = UnitTypeKind> {
    id: string;
    type: TKind;
    documentation: DocumentationBlock;
    metadata?: DataItemMetadataConfig;
    status?: DataItemStatusConfig;
}

export interface UnitTypeDefinition {
    id: string;
    documentation: DocumentationBlock;
    items: DataItemType[];
    metadata?: UnitTypeMetadataConfig;
    status?: UnitTypeStatusConfig;
}

export interface UnitTypeStatusConfig extends Record<string, unknown> {
    rules: "incomplete" | "valid" | "invalid" | "warning";
    edition: "system" | "user";
}

export interface UnitTypeMetadataConfig extends Record<string, unknown> {
    createdAt?: boolean;
    updatedAt?: boolean;
    createdBy?: boolean;
    updatedBy?: boolean;
    enableVersioning?: boolean;
    historizeChanges?: boolean;
    trackStatusHistory?: boolean;
    enforceStatusDefinitions?: boolean;
    allowDrafts?: boolean;
    softDelete?: boolean;
    retentionPolicyDays?: number;
}

export type UnitTypeMap = Record<string, DataItemType>;

export type UnitValues = Record<string, UnitValue | undefined>;

export interface UnitMetadata extends StatusAwareMetadata {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    version?: number;
    retention?: {
        policy?: string;
        expiresAt?: string;
    };
    lifecycle?: {
        archivedAt?: string;
        deletedAt?: string;
        restoredAt?: string;
    };
    statusCatalog?: Record<string, StatusDescriptor>;
    itemStatuses?: Record<string, StatusDescriptor | Record<string, StatusDescriptor>>;
}

export interface UnitRecord {
    id: string;
    unitTypeId: string;
    values: UnitValues;
    metadata?: UnitMetadata;
}

/**
 * Payload to create units referencing a persisted unit type.
 *
 * `unitTypeId` is required because the unit type lives in the database.
 */
export type CreateUnitInput = Omit<UnitRecord, "id"> & {
    id?: string;
};

/**
 * Payload to create units using inline unit type definitions.
 *
 * The definition is passed separately, so `unitTypeId` would be redundant.
 */
export type CreateInlineUnitInput = Omit<CreateUnitInput, "unitTypeId">;

export type QueryOrderDirection = "asc" | "desc";

export interface QueryFilterValue {
    value: unknown;
    operator?: string;
}

export type QueryFilters = Record<string, QueryFilterValue>;

export type QueryProjection = Record<string, 0 | 1 | boolean>;

export interface UnitListOptions {
    filters?: QueryFilters;
    order?: Record<string, QueryOrderDirection>;
    limit?: number;
    offset?: number;
    fields?: QueryProjection;
    search?: string;
}

export interface UnitListQuery extends UnitListOptions {
    typeId: string;
}

export interface UpdateUnitPatch {
    values?: UnitValues;
    metadata?: UnitMetadata;
}

export interface Unit extends UnitRecord {
    createdAt: Date;
    updatedAt: Date;
}

export interface StoredDataItemDocument {
    id: string; // technical identifier
    businessId: string;
    type: UnitTypeKind;
    documentation?: DocumentationBlock;
    metadata?: DataItemMetadataConfig;
}

export interface StoredUnitTypeDocument {
    id: string; // technical identifier
    businessId: string;
    documentation: DocumentationBlock;
    items: StoredDataItemDocument[];
    metadata?: UnitTypeMetadataConfig;
    createdAt: Date;
    updatedAt: Date;
}

export interface StoredUnitType extends UnitTypeDefinition {
    createdAt: Date;
    updatedAt: Date;
}

export interface StoredUnitMetadata extends Omit<UnitMetadata, "itemStatuses"> {
    itemStatuses?: Record<string, StatusDescriptor | Record<string, StatusDescriptor>>;
}

export interface StoredUnitDocument {
    id: string; // technical identifier
    businessId: string;
    typeId: string; // technical unit type id
    values: Record<string, unknown>;
    metadata?: StoredUnitMetadata;
    createdAt: Date;
    updatedAt: Date;
}

export type UnitWriteOperation = "create" | "update";

export interface ValidationContext {
    operation: UnitWriteOperation;
    unitType: StoredUnitType;
    unit: Unit;
}

export type ValidationHandler = (context: ValidationContext) => Promise<void>;

export interface CrystalDBOptions {
    adapter: CrystalDatabaseAdapter;
    validationHandler?: ValidationHandler;
}

export type UnitValue =
    | string
    | number
    | boolean
    | PercentageValue
    | NumberRangeValue
    | DateValue
    | MonthValue
    | EnumValue
    | FilesValue
    | FormulaValue
    | DateRangeValue
    | DistanceValue
    | IconValue
    | GeoAddressValue
    | ReferenceValue
    | Value
    | null;

export type LocalizedString = string | Record<string, string>;

export interface DocumentationBlock {
    name: LocalizedString;
    description: LocalizedString;
    icon?: string;
    tags?: string[];
    links?: Array<{ label: LocalizedString; url: string }>;
    examples?: LocalizedString[];
}

export interface StatusDescriptor {
    type: string;
    value: string;
    since?: string;
    notes?: LocalizedString;
    updatedBy?: string;
    metadata?: Record<string, unknown>;
}

export interface StatusAwareMetadata extends Record<string, unknown> {
    status?: StatusDescriptor | Record<string, StatusDescriptor>;
    statusHistory?: StatusDescriptor[];
    statusContext?: string;
    escalation?: {
        level?: string;
        since?: string;
        assignedTo?: string;
    };
}

export interface SerializationContext {
    existingValues?: Record<string, unknown>;
    existingValueStatuses?: Record<string, StatusDescriptor | Record<string, StatusDescriptor>>;
}

export interface CrystalDatabaseAdapter {
    initialize(): Promise<void>;
    upsertUnitType(document: StoredUnitTypeDocument): Promise<void>;
    findUnitTypeByBusinessId(businessId: string): Promise<StoredUnitTypeDocument | null>;
    findUnitTypeById(id: string): Promise<StoredUnitTypeDocument | null>;
    insertUnit(doc: StoredUnitDocument): Promise<void>;
    replaceUnit(doc: StoredUnitDocument): Promise<void>;
    findUnitByBusinessId(businessId: string): Promise<StoredUnitDocument | null>;
    findUnitById(id: string): Promise<StoredUnitDocument | null>;
    listUnits(query: UnitListQuery): Promise<StoredUnitDocument[]>;
}

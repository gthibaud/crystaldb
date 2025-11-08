import type { DateValue } from "./kinds/date/types";
import type { DateRangeValue } from "./kinds/dateRange/types";
import type { DistanceValue } from "./kinds/distance/types";
import type { EnumValue } from "./kinds/enum/types";
import type { FilesValue } from "./kinds/files/types";
import type { FormulaValue } from "./kinds/formula/types";
import type { GeoAddressValue } from "./kinds/geoAddress/types";
import type { IconValue } from "./kinds/icon/types";
import type { MonthValue } from "./kinds/month/types";
import type { NumberRangeValue } from "./kinds/numberRange/types";
import type { PercentageValue } from "./kinds/percentage/types";
import type { ReferenceValue } from "./kinds/reference/types";

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

export interface Value {
    metadata?: StatusAwareMetadata;
}

export type UnitTypeKind =
    | "string"
    | "markdown"
    | "number"
    | "numberRange"
    | "boolean"
    | "date"
    | "month"
    | "enum"
    | "files"
    | "formula"
    | "dateRange"
    | "distance"
    | "icon"
    | "percentage"
    | "geoAddress"
    | "reference";

export interface DataItemStatusConfig {
    default?: StatusDescriptor;
    allowed?: Record<string, StatusDescriptor>;
    allowCustom?: boolean;
    propagateToUnit?: boolean;
    blockers?: string[];
}

export interface DataItemMetadataConfig extends Record<string, unknown> {
    required?: boolean;
    unique?: boolean;
    indexed?: boolean;
    immutable?: boolean;
    status?: DataItemStatusConfig;
    auditTrail?: boolean;
    visibility?: "public" | "private" | "restricted";
    category?: string;
    retentionDays?: number;
}

export interface DataItemType<TKind extends UnitTypeKind = UnitTypeKind> {
    id: string;
    type: TKind;
    documentation?: DocumentationBlock;
    description?: string;
    metadata?: DataItemMetadataConfig;
}

export interface UnitTypeDefinition {
    id: string;
    documentation: DocumentationBlock;
    items: DataItemType[];
    metadata?: UnitTypeMetadataConfig;
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
    statusCatalog?: Record<string, StatusDescriptor>;
    defaultStatuses?: Record<string, StatusDescriptor>;
    permissions?: {
        read?: string[];
        write?: string[];
        admin?: string[];
    };
    notifications?: {
        onStatusChange?: boolean;
        onAssignment?: boolean;
    };
}

export type UnitTypeMap = Record<string, DataItemType>;

export type UnitValues = Record<string, UnitValue | undefined>;

export interface UnitMetadata extends StatusAwareMetadata {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    version?: number;
    tags?: string[];
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
    type: string;
    values: UnitValues;
    metadata?: UnitMetadata;
}

export type CreateUnitInput = Omit<UnitRecord, "id"> & { id?: string };

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
}

import { deserializeUnitValues, serializeUnitValues } from "./kinds";
import {
    CreateInlineUnitInput,
    CreateUnitInput,
    CrystalDBOptions,
    CrystalDatabaseAdapter,
    StoredUnitDocument,
    StoredUnitMetadata,
    StoredUnitType,
    StoredUnitTypeDocument,
    Unit,
    UnitListOptions,
    UnitMetadata,
    UnitTypeDefinition,
    UnitWriteOperation,
    UpdateUnitPatch,
    ValidationHandler,
} from "./types";

let cachedIdGenerator: (() => string) | null = null;

const loadIdGenerator = async (): Promise<() => string> => {
    if (!cachedIdGenerator) {
        const module = await import("gthibaud-uid");
        cachedIdGenerator = module.generateId;
    }
    return cachedIdGenerator;
};

/**
 * High-level entry point for interacting with CrystalDB unit types and units.
 *
 * The class exposes two complementary workflows:
 * - **Database-backed definitions**: persist unit type schemas in the database and reference them by id.
 * - **Inline definitions**: pass unit type schemas directly from code without storing them.
 *
 * Both approaches share serialization, validation, and adapter logic so teams can pick the model that fits.
 */
export class CrystalDB {
    private readonly adapter: CrystalDatabaseAdapter;
    private validationHandler?: ValidationHandler;

    /**
     * Instantiate CrystalDB with a storage adapter and optional validation handler.
     */
    constructor(options: CrystalDBOptions) {
        this.adapter = options.adapter;
        this.validationHandler = options.validationHandler;
    }

    /**
     * Ensure the underlying adapter is ready (indexes, collections, etc.).
     */
    async initialize(): Promise<void> {
        await this.adapter.initialize();
    }

    /**
     * Register or remove a validation handler executed before writes.
     */
    setValidationHandler(handler: ValidationHandler | undefined): void {
        this.validationHandler = handler;
    }

    /**
     * Create or update a persisted unit type definition in the database.
     */
    async upsertUnitType(definition: UnitTypeDefinition): Promise<StoredUnitType> {
        const existingDocument =
            (await this.adapter.findUnitTypeByBusinessId(definition.id)) ?? null;

        const id = existingDocument?.id ?? (await this.generateTechnicalId());
        const createdAt = existingDocument?.createdAt ?? new Date();
        const updatedAt = new Date();

        const existingItemMap = new Map(
            (existingDocument?.items ?? []).map((item) => [item.businessId, item])
        );

        const items = await Promise.all(
            definition.items.map(async (item) => {
                const existing = existingItemMap.get(item.id);
                return {
                    id: existing?.id ?? (await this.generateTechnicalId()),
                    businessId: item.id,
                    type: item.type,
                    documentation: item.documentation,
                    metadata: item.metadata,
                };
            })
        );

        const document: StoredUnitTypeDocument = {
            id,
            businessId: definition.id,
            documentation: definition.documentation,
            items,
            metadata: definition.metadata,
            createdAt,
            updatedAt,
        };

        await this.adapter.upsertUnitType(document);

        return this.mapUnitTypeDocumentToDomain(document);
    }

    /**
     * Retrieve a stored unit type definition by its business identifier.
     */
    async getUnitTypeById(id: string): Promise<StoredUnitType | null> {
        const document = await this.adapter.findUnitTypeByBusinessId(id);
        return document ? this.mapUnitTypeDocumentToDomain(document) : null;
    }

    /**
     * Create a unit referencing a database-backed unit type.
     *
     * Requires the unit type to have been persisted through `upsertUnitType`.
     */
    async createUnit(unit: CreateUnitInput): Promise<Unit> {
        const bundle = await this.getUnitTypeBundleByBusinessId(unit.unitTypeId);

        const unitId = await this.generateTechnicalId();
        const businessId = await this.resolveBusinessId(unit.id);
        const now = new Date();

        const serializedValues = serializeUnitValues(bundle.domain, unit.values);
        const storedValues = this.mapBusinessValuesToTechnical(bundle, serializedValues);
        const storedMetadata = this.serializeUnitMetadata(bundle, unit.metadata);

        const storedDoc: StoredUnitDocument = {
            id: unitId,
            businessId,
            typeId: bundle.document.id,
            values: storedValues,
            metadata: storedMetadata,
            createdAt: now,
            updatedAt: now,
        };

        const domainUnit = this.buildDomainUnit(bundle, storedDoc);
        await this.runValidation("create", bundle.domain, domainUnit);

        await this.adapter.insertUnit(storedDoc);
        return domainUnit;
    }

    /**
     * Apply a patch to an existing unit referencing a database-backed unit type.
     */
    async updateUnit(unitId: string, patch: UpdateUnitPatch): Promise<Unit | null> {
        const existingDoc = await this.adapter.findUnitByBusinessId(unitId);
        if (!existingDoc) {
            return null;
        }

        const bundle = await this.getUnitTypeBundleByTechnicalId(existingDoc.typeId);
        const existingDomain = this.buildDomainUnit(bundle, existingDoc);

        const mergedValues = patch.values
            ? {
                ...existingDomain.values,
                ...patch.values,
            }
            : existingDomain.values;

        const baseValues = this.mapTechnicalValuesToBusinessRaw(bundle, existingDoc.values);

        const serializedValues = serializeUnitValues(bundle.domain, mergedValues, {
            existingValues: baseValues,
        });

        const storedValues = this.mapBusinessValuesToTechnical(bundle, serializedValues);
        const mergedMetadata = patch.metadata
            ? {
                ...existingDomain.metadata,
                ...patch.metadata,
            }
            : existingDomain.metadata;
        const storedMetadata = this.serializeUnitMetadata(bundle, mergedMetadata);

        const updatedDoc: StoredUnitDocument = {
            ...existingDoc,
            values: storedValues,
            metadata: storedMetadata,
            updatedAt: new Date(),
        };

        const domainUnit = this.buildDomainUnit(bundle, updatedDoc);

        await this.runValidation("update", bundle.domain, domainUnit);
        await this.adapter.replaceUnit(updatedDoc);

        return domainUnit;
    }

    /**
     * Retrieve a unit by its business identifier using the persisted unit type definition.
     */
    async getUnitById(id: string): Promise<Unit | null> {
        const stored = await this.adapter.findUnitByBusinessId(id);
        if (!stored) {
            return null;
        }

        const bundle = await this.getUnitTypeBundleByTechnicalId(stored.typeId);
        return this.buildDomainUnit(bundle, stored);
    }

    /**
     * List units for the given unit type, delegating filtering and pagination to the adapter.
     *
     * @param unitTypeId Business identifier of the unit type to list.
     * @param options Filtering, ordering and pagination options.
     * @param overrides Provide an inline unit type definition instead of reading from the database.
     */
    async listUnits(
        unitTypeId: string,
        options?: UnitListOptions,
        overrides?: { unitType?: UnitTypeDefinition }
    ): Promise<Unit[]> {
        const bundle = overrides?.unitType
            ? this.buildUnitTypeBundleFromDefinition(overrides.unitType, unitTypeId)
            : await this.getUnitTypeBundleByBusinessId(unitTypeId);

        return this.listUnitsForBundle(bundle, options);
    }

    /**
     * Create a unit using an inline unit type definition without persisting the schema.
     *
     * Useful for tests or applications that prefer configuration in code rather than in the database.
     */
    async createInlineUnit(
        definition: UnitTypeDefinition,
        unit: CreateInlineUnitInput
    ): Promise<Unit> {
        const bundle = this.buildUnitTypeBundleFromDefinition(definition);

        const unitId = await this.generateTechnicalId();
        const businessId = await this.resolveBusinessId(unit.id);
        const now = new Date();

        const serializedValues = serializeUnitValues(bundle.domain, unit.values);
        const storedValues = this.mapBusinessValuesToTechnical(bundle, serializedValues);
        const storedMetadata = this.serializeUnitMetadata(bundle, unit.metadata);

        const storedDoc: StoredUnitDocument = {
            id: unitId,
            businessId,
            typeId: bundle.document.id,
            values: storedValues,
            metadata: storedMetadata,
            createdAt: now,
            updatedAt: now,
        };

        const domainUnit = this.buildDomainUnit(bundle, storedDoc);
        await this.runValidation("create", bundle.domain, domainUnit);

        await this.adapter.insertUnit(storedDoc);
        return domainUnit;
    }

    /**
     * Update a unit using the provided inline unit type definition.
     *
     * Ensures the stored unit references the same definition id to avoid mismatches.
     */
    async updateInlineUnit(
        definition: UnitTypeDefinition,
        unitId: string,
        patch: UpdateUnitPatch
    ): Promise<Unit | null> {
        const existingDoc = await this.adapter.findUnitByBusinessId(unitId);
        if (!existingDoc) {
            return null;
        }

        if (existingDoc.typeId !== definition.id) {
            throw new Error(
                `Stored unit type "${existingDoc.typeId}" does not match inline definition "${definition.id}"`
            );
        }

        const bundle = this.buildUnitTypeBundleFromDefinition(definition, existingDoc.typeId);
        const existingDomain = this.buildDomainUnit(bundle, existingDoc);

        const mergedValues = patch.values
            ? {
                ...existingDomain.values,
                ...patch.values,
            }
            : existingDomain.values;

        const baseValues = this.mapTechnicalValuesToBusinessRaw(bundle, existingDoc.values);

        const serializedValues = serializeUnitValues(bundle.domain, mergedValues, {
            existingValues: baseValues,
        });

        const storedValues = this.mapBusinessValuesToTechnical(bundle, serializedValues);
        const mergedMetadata = patch.metadata
            ? {
                ...existingDomain.metadata,
                ...patch.metadata,
            }
            : existingDomain.metadata;
        const storedMetadata = this.serializeUnitMetadata(bundle, mergedMetadata);

        const updatedDoc: StoredUnitDocument = {
            ...existingDoc,
            values: storedValues,
            metadata: storedMetadata,
            updatedAt: new Date(),
        };

        const domainUnit = this.buildDomainUnit(bundle, updatedDoc);

        await this.runValidation("update", bundle.domain, domainUnit);
        await this.adapter.replaceUnit(updatedDoc);

        return domainUnit;
    }

    /**
     * Retrieve a unit using an inline unit type definition.
     *
     * Throws if the stored unit references a different definition id to guard against accidental misuse.
     */
    async getInlineUnitById(definition: UnitTypeDefinition, id: string): Promise<Unit | null> {
        const stored = await this.adapter.findUnitByBusinessId(id);
        if (!stored) {
            return null;
        }

        if (stored.typeId !== definition.id) {
            throw new Error(
                `Stored unit type "${stored.typeId}" does not match inline definition "${definition.id}"`
            );
        }

        const bundle = this.buildUnitTypeBundleFromDefinition(definition, stored.typeId);
        return this.buildDomainUnit(bundle, stored);
    }

    private async listUnitsForBundle(
        bundle: UnitTypeBundle,
        options?: UnitListOptions
    ): Promise<Unit[]> {
        const query = {
            ...(options ?? {}),
            typeId: bundle.document.id,
        };

        const storedDocs = await this.adapter.listUnits(query);
        return storedDocs.map((doc) => this.buildDomainUnit(bundle, doc));
    }

    private buildUnitTypeBundleFromDefinition(
        definition: UnitTypeDefinition,
        expectedId?: string
    ): UnitTypeBundle {
        if (expectedId && definition.id !== expectedId) {
            throw new Error(
                `Provided unit type definition id "${definition.id}" does not match expected id "${expectedId}"`
            );
        }

        const timestamp = new Date();
        const document: StoredUnitTypeDocument = {
            id: definition.id,
            businessId: definition.id,
            documentation: definition.documentation,
            items: definition.items.map((item) => ({
                id: item.id,
                businessId: item.id,
                type: item.type,
                documentation: item.documentation,
                metadata: item.metadata,
            })),
            metadata: definition.metadata,
            createdAt: timestamp,
            updatedAt: timestamp,
        };

        const domain = this.mapUnitTypeDocumentToDomain(document);

        return {
            document,
            domain,
            maps: this.buildItemMaps(document),
        };
    }

    private async runValidation(
        operation: UnitWriteOperation,
        unitType: StoredUnitType,
        unit: Unit
    ): Promise<void> {
        if (!this.validationHandler) {
            return;
        }

        await this.validationHandler({
            operation,
            unitType,
            unit,
        });
    }

    private async generateTechnicalId(): Promise<string> {
        const generator = await loadIdGenerator();
        return generator();
    }

    private async resolveBusinessId(providedId?: string): Promise<string> {
        if (providedId) {
            return providedId;
        }
        return this.generateTechnicalId();
    }

    private mapUnitTypeDocumentToDomain(document: StoredUnitTypeDocument): StoredUnitType {
        return {
            id: document.businessId,
            documentation: document.documentation,
            items: document.items.map((item) => ({
                id: item.businessId,
                type: item.type,
                documentation: item.documentation ?? { name: {}, description: {} },
                metadata: item.metadata,
            })),
            metadata: document.metadata,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
        };
    }

    private buildItemMaps(document: StoredUnitTypeDocument): {
        businessToTechnical: Map<string, string>;
        technicalToBusiness: Map<string, string>;
    } {
        const businessToTechnical = new Map<string, string>();
        const technicalToBusiness = new Map<string, string>();

        for (const item of document.items) {
            businessToTechnical.set(item.businessId, item.id);
            technicalToBusiness.set(item.id, item.businessId);
        }

        return { businessToTechnical, technicalToBusiness };
    }

    private async getUnitTypeBundleByBusinessId(businessId: string): Promise<UnitTypeBundle> {
        const document = await this.adapter.findUnitTypeByBusinessId(businessId);
        if (!document) {
            throw new Error(`Unit type ${businessId} not found`);
        }
        return this.buildUnitTypeBundle(document);
    }

    private async getUnitTypeBundleByTechnicalId(typeId: string): Promise<UnitTypeBundle> {
        const document = await this.adapter.findUnitTypeById(typeId);
        if (!document) {
            throw new Error(`Unit type with technical id ${typeId} not found`);
        }
        return this.buildUnitTypeBundle(document);
    }

    private buildUnitTypeBundle(document: StoredUnitTypeDocument): UnitTypeBundle {
        const domain = this.mapUnitTypeDocumentToDomain(document);
        const maps = this.buildItemMaps(document);
        return {
            document,
            domain,
            maps,
        };
    }

    private mapBusinessValuesToTechnical(
        bundle: UnitTypeBundle,
        values: Record<string, unknown>
    ): Record<string, unknown> {
        const technicalValues: Record<string, unknown> = {};

        for (const [businessId, value] of Object.entries(values)) {
            const technicalId = bundle.maps.businessToTechnical.get(businessId);
            if (!technicalId) {
                throw new Error(
                    `Unknown data item "${businessId}" for unit type ${bundle.domain.id}`
                );
            }
            technicalValues[technicalId] = value;
        }

        return technicalValues;
    }

    private mapTechnicalValuesToBusinessRaw(
        bundle: UnitTypeBundle,
        values: Record<string, unknown> | undefined
    ): Record<string, unknown> {
        if (!values) {
            return {};
        }

        const businessValues: Record<string, unknown> = {};
        for (const [technicalId, value] of Object.entries(values)) {
            const businessId = bundle.maps.technicalToBusiness.get(technicalId);
            if (!businessId) {
                continue;
            }
            businessValues[businessId] = value;
        }

        return businessValues;
    }

    private serializeUnitMetadata(
        bundle: UnitTypeBundle,
        metadata?: UnitMetadata
    ): StoredUnitMetadata | undefined {
        if (!metadata) {
            return undefined;
        }

        const { itemStatuses, ...rest } = metadata;
        const stored: StoredUnitMetadata = { ...rest };

        if (itemStatuses) {
            const mapped: StoredUnitMetadata["itemStatuses"] = {};
            for (const [businessId, status] of Object.entries(itemStatuses)) {
                const technicalId = bundle.maps.businessToTechnical.get(businessId);
                if (!technicalId) {
                    continue;
                }
                mapped[technicalId] = status;
            }
            stored.itemStatuses = mapped;
        }

        return stored;
    }

    private deserializeUnitMetadata(
        bundle: UnitTypeBundle,
        metadata?: StoredUnitMetadata
    ): UnitMetadata | undefined {
        if (!metadata) {
            return undefined;
        }

        const { itemStatuses, ...rest } = metadata;
        const domain: UnitMetadata = { ...rest };

        if (itemStatuses) {
            const mapped: UnitMetadata["itemStatuses"] = {};
            for (const [technicalId, status] of Object.entries(itemStatuses)) {
                const businessId = bundle.maps.technicalToBusiness.get(technicalId);
                if (!businessId) {
                    continue;
                }
                mapped[businessId] = status;
            }
            domain.itemStatuses = mapped;
        }

        return domain;
    }

    private buildDomainUnit(bundle: UnitTypeBundle, doc: StoredUnitDocument): Unit {
        const businessValues = this.mapTechnicalValuesToBusinessRaw(bundle, doc.values);
        const deserializedValues = deserializeUnitValues(bundle.domain, businessValues);
        const metadata = this.deserializeUnitMetadata(bundle, doc.metadata);

        return {
            id: doc.businessId,
            unitTypeId: bundle.domain.id,
            values: deserializedValues,
            metadata,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }
}

interface UnitTypeBundle {
    document: StoredUnitTypeDocument;
    domain: StoredUnitType;
    maps: {
        businessToTechnical: Map<string, string>;
        technicalToBusiness: Map<string, string>;
    };
}

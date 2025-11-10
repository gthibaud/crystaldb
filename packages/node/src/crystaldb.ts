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
    UnitClassConstructor,
    UnitClassInstance,
    UnitListOptions,
    UnitMetadata,
    UnitTypeDefinition,
    UnitWriteOperation,
    UpdateUnitPatch,
    ValidationHandler,
    applyUnitToClassInstance,
    deserializeUnitValues,
    extractClassInstanceData,
    getUnitTypeDefinitionForClass,
    instantiateUnitClass,
    isUnitClassInstance,
    serializeUnitValues,
} from "@crystaldb/core";

let cachedIdGenerator: (() => string) | null = null;

const loadIdGenerator = async (): Promise<() => string> => {
    if (!cachedIdGenerator) {
        const module = await import("gthibaud-uid");
        cachedIdGenerator = module.generateId;
    }
    return cachedIdGenerator;
};

type DomainUnit = Unit | UnitClassInstance;

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
    async createUnit(unit: CreateUnitInput): Promise<DomainUnit>;
    async createUnit<TInstance extends UnitClassInstance>(unit: TInstance): Promise<TInstance>;
    async createUnit(
        unit: CreateUnitInput | UnitClassInstance
    ): Promise<DomainUnit | UnitClassInstance> {
        if (isUnitClassInstance(unit)) {
            const extracted = extractClassInstanceData(unit);
            if (!extracted) {
                throw new Error("Unable to extract data from registered unit class instance");
            }

            const createdUnit = await this.createUnitInternal({
                id: extracted.id,
                unitTypeId: extracted.unitTypeId,
                values: extracted.values,
                metadata: extracted.metadata,
            });

            applyUnitToClassInstance(createdUnit, unit);
            return unit;
        }

        const createdUnit = await this.createUnitInternal(unit);
        return this.materializeUnit(createdUnit);
    }

    private async createUnitInternal(unit: CreateUnitInput): Promise<Unit> {
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
    async updateUnit(unitId: string, patch: UpdateUnitPatch): Promise<DomainUnit | null> {
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

        return this.materializeUnit(domainUnit);
    }

    /**
     * Retrieve a unit by its business identifier using the persisted unit type definition.
     */
    async getUnitById(id: string): Promise<DomainUnit | null>;
    async getUnitById<TInstance extends UnitClassInstance>(
        unitClass: UnitClassConstructor<TInstance>,
        id: string
    ): Promise<TInstance | null>;
    async getUnitById(
        idOrClass: string | UnitClassConstructor<UnitClassInstance>,
        maybeId?: string
    ): Promise<DomainUnit | UnitClassInstance | null> {
        if (typeof idOrClass === "function") {
            if (!maybeId) {
                throw new Error("getUnitById requires an id when a unit class is provided");
            }

            const definition = getUnitTypeDefinitionForClass(idOrClass);
            if (!definition) {
                throw new Error(
                    `Unit class "${idOrClass.name ?? "anonymous"}" is not registered for any unit type`
                );
            }

            const stored = await this.adapter.findUnitByBusinessId(maybeId);
            if (!stored) {
                return null;
            }

            const bundle = await this.getUnitTypeBundleByTechnicalId(stored.typeId);
            const baseUnit = this.buildDomainUnit(bundle, stored);

            if (baseUnit.unitTypeId !== definition.id) {
                throw new Error(
                    `Stored unit type "${baseUnit.unitTypeId}" does not match registered class "${definition.id}"`
                );
            }

            const materialized = this.materializeUnit(baseUnit);
            if (!(materialized instanceof idOrClass)) {
                throw new Error(
                    `Registered class for unit type "${definition.id}" did not produce an instance of the expected constructor`
                );
            }
            return materialized as UnitClassInstance;
        }

        const stored = await this.adapter.findUnitByBusinessId(idOrClass);
        if (!stored) {
            return null;
        }

        const bundle = await this.getUnitTypeBundleByTechnicalId(stored.typeId);
        const baseUnit = this.buildDomainUnit(bundle, stored);
        return this.materializeUnit(baseUnit);
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
    ): Promise<DomainUnit[]>;
    async listUnits<TInstance extends UnitClassInstance>(
        unitClass: UnitClassConstructor<TInstance>,
        options?: UnitListOptions,
        overrides?: { unitType?: UnitTypeDefinition }
    ): Promise<TInstance[]>;
    async listUnits(
        unitTypeOrClass: string | UnitClassConstructor<UnitClassInstance>,
        options?: UnitListOptions,
        overrides?: { unitType?: UnitTypeDefinition }
    ): Promise<Array<DomainUnit | UnitClassInstance>> {
        if (typeof unitTypeOrClass === "function") {
            const definition = getUnitTypeDefinitionForClass(unitTypeOrClass);
            if (!definition) {
                throw new Error(
                    `Unit class "${unitTypeOrClass.name ?? "anonymous"}" is not registered for any unit type`
                );
            }

            if (overrides?.unitType && overrides.unitType.id !== definition.id) {
                throw new Error(
                    `Override unit type "${overrides.unitType.id}" does not match registered class "${definition.id}"`
                );
            }

            const unitTypeId = definition.id;
            const persistedDocument = await this.adapter.findUnitTypeByBusinessId(unitTypeId);
            let bundle: UnitTypeBundle;
            if (overrides?.unitType) {
                bundle = this.buildUnitTypeBundleFromDefinition(overrides.unitType, unitTypeId);
            } else if (persistedDocument) {
                bundle = this.buildUnitTypeBundle(persistedDocument);
            } else {
                bundle = this.buildUnitTypeBundleFromDefinition(definition);
            }

            const results = await this.listUnitsForBundle(bundle, options);

            return results.map((unit) => {
                if (!(unit instanceof unitTypeOrClass)) {
                    throw new Error(
                        `Registered class for unit type "${definition.id}" did not produce instances of the expected constructor`
                    );
                }
                return unit;
            }) as UnitClassInstance[];
        }

        const bundle = overrides?.unitType
            ? this.buildUnitTypeBundleFromDefinition(overrides.unitType, unitTypeOrClass)
            : await this.getUnitTypeBundleByBusinessId(unitTypeOrClass);

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
    ): Promise<DomainUnit>;
    async createInlineUnit<TInstance extends UnitClassInstance>(
        unit: TInstance
    ): Promise<TInstance>;
    async createInlineUnit<TInstance extends UnitClassInstance>(
        definition: UnitTypeDefinition,
        unit: TInstance
    ): Promise<TInstance>;
    async createInlineUnit(
        definitionOrInstance: UnitTypeDefinition | UnitClassInstance,
        unitMaybe?: CreateInlineUnitInput | UnitClassInstance
    ): Promise<DomainUnit | UnitClassInstance> {
        if (isUnitClassInstance(definitionOrInstance)) {
            const definition = getUnitTypeDefinitionForClass(
                definitionOrInstance.constructor as UnitClassConstructor<UnitClassInstance>
            );
            if (!definition) {
                throw new Error(
                    "Inline unit instance is not associated with a registered unit type"
                );
            }

            const extracted = extractClassInstanceData(definitionOrInstance);
            if (!extracted) {
                throw new Error("Unable to extract data from registered unit class instance");
            }

            const createdUnit = await this.createInlineUnitInternal(definition, {
                id: extracted.id,
                values: extracted.values,
                metadata: extracted.metadata,
            });

            applyUnitToClassInstance(createdUnit, definitionOrInstance);
            return definitionOrInstance;
        }

        if (unitMaybe && isUnitClassInstance(unitMaybe)) {
            if (unitMaybe.unitTypeId && unitMaybe.unitTypeId !== definitionOrInstance.id) {
                throw new Error(
                    `Inline unit instance type "${unitMaybe.unitTypeId}" does not match definition "${definitionOrInstance.id}"`
                );
            }

            const extracted = extractClassInstanceData(unitMaybe);
            if (!extracted) {
                throw new Error("Unable to extract data from registered unit class instance");
            }

            const createdUnit = await this.createInlineUnitInternal(definitionOrInstance, {
                id: extracted.id,
                values: extracted.values,
                metadata: extracted.metadata,
            });

            applyUnitToClassInstance(createdUnit, unitMaybe);
            return unitMaybe;
        }

        if (!unitMaybe) {
            throw new Error("createInlineUnit requires a unit payload for the provided definition");
        }

        const createdUnit = await this.createInlineUnitInternal(definitionOrInstance, unitMaybe);
        return this.materializeUnit(createdUnit);
    }

    private async createInlineUnitInternal(
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
    ): Promise<DomainUnit | null> {
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

        return this.materializeUnit(domainUnit);
    }

    /**
     * Retrieve a unit using an inline unit type definition.
     *
     * Throws if the stored unit references a different definition id to guard against accidental misuse.
     */
    async getInlineUnitById(
        definition: UnitTypeDefinition,
        id: string
    ): Promise<DomainUnit | null> {
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
        const baseUnit = this.buildDomainUnit(bundle, stored);
        return this.materializeUnit(baseUnit);
    }

    private async listUnitsForBundle(
        bundle: UnitTypeBundle,
        options?: UnitListOptions
    ): Promise<DomainUnit[]> {
        const query = {
            ...(options ?? {}),
            typeId: bundle.document.id,
        };

        const storedDocs = await this.adapter.listUnits(query);
        return storedDocs.map((doc) => this.materializeUnit(this.buildDomainUnit(bundle, doc)));
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

    private materializeUnit(unit: Unit): DomainUnit {
        return instantiateUnitClass(unit) as DomainUnit;
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

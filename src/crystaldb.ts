import { deserializeUnitValues, serializeUnitValues } from "./kinds";
import {
    CreateUnitInput,
    CrystalDBOptions,
    CrystalDatabaseAdapter,
    IdGenerator,
    StoredUnitDocument,
    StoredUnitType,
    Unit,
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

export class CrystalDB {
    private readonly adapter: CrystalDatabaseAdapter;
    private readonly idGenerator?: IdGenerator;
    private validationHandler?: ValidationHandler;

    constructor(options: CrystalDBOptions) {
        this.adapter = options.adapter;
        this.idGenerator = options.idGenerator;
        this.validationHandler = options.validationHandler;
    }

    async initialize(): Promise<void> {
        await this.adapter.initialize();
    }

    setValidationHandler(handler: ValidationHandler | undefined): void {
        this.validationHandler = handler;
    }

    async upsertUnitType(definition: UnitTypeDefinition): Promise<StoredUnitType> {
        const now = new Date();
        return this.adapter.upsertUnitType(definition, now);
    }

    async getUnitTypeById(id: string): Promise<StoredUnitType | null> {
        return this.adapter.getUnitTypeById(id);
    }

    async createUnit(unit: CreateUnitInput): Promise<Unit> {
        const unitType = await this.getUnitTypeOrThrow(unit.type);

        const unitId = await this.resolveUnitId(unit.id);
        const now = new Date();

        const serializedValues = serializeUnitValues(unitType, unit.values);
        const storedDoc: StoredUnitDocument = {
            id: unitId,
            type: unit.type,
            values: serializedValues,
            metadata: unit.metadata ?? {},
            createdAt: now,
            updatedAt: now,
        };

        const domainUnit = this.buildUnitFromDocument(unitType, storedDoc);
        await this.runValidation("create", unitType, domainUnit);

        await this.adapter.insertUnit(storedDoc);
        return domainUnit;
    }

    async updateUnit(unitId: string, patch: UpdateUnitPatch): Promise<Unit | null> {
        const existingDoc = await this.adapter.getUnitById(unitId);
        if (!existingDoc) {
            return null;
        }

        const unitType = await this.getUnitTypeOrThrow(existingDoc.type);
        const existingDomain = this.buildUnitFromDocument(unitType, existingDoc);

        const mergedValues = patch.values
            ? {
                  ...existingDomain.values,
                  ...patch.values,
              }
            : existingDomain.values;

        const serializedValues = serializeUnitValues(unitType, mergedValues, {
            existingValues: existingDoc.values,
        });

        const updatedDoc: StoredUnitDocument = {
            ...existingDoc,
            values: serializedValues,
            metadata: patch.metadata ?? existingDoc.metadata,
            updatedAt: new Date(),
        };

        const domainUnit = this.buildUnitFromDocument(unitType, updatedDoc);

        await this.runValidation("update", unitType, domainUnit);
        await this.adapter.replaceUnit(updatedDoc);

        return domainUnit;
    }

    async getUnitById(id: string): Promise<Unit | null> {
        const stored = await this.adapter.getUnitById(id);
        if (!stored) {
            return null;
        }

        const unitType = await this.getUnitTypeOrThrow(stored.type);
        return this.buildUnitFromDocument(unitType, stored);
    }

    private async getUnitTypeOrThrow(typeId: string): Promise<StoredUnitType> {
        const unitType = await this.getUnitTypeById(typeId);
        if (!unitType) {
            throw new Error(`Unit type ${typeId} not found`);
        }
        return unitType;
    }

    private buildUnitFromDocument(unitType: StoredUnitType, doc: StoredUnitDocument): Unit {
        return {
            id: doc.id,
            type: doc.type,
            values: deserializeUnitValues(unitType, doc.values),
            metadata: doc.metadata,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
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

    private async resolveUnitId(providedId?: string): Promise<string> {
        if (providedId) {
            return providedId;
        }
        if (this.idGenerator) {
            const generated = this.idGenerator();
            return generated instanceof Promise ? await generated : generated;
        }
        const generator = await loadIdGenerator();
        return generator();
    }
}

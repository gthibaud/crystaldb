import { Collection, Db, MongoClient } from "mongodb";
import {
    CrystalDatabaseAdapter,
    StoredUnitDocument,
    StoredUnitType,
    UnitTypeDefinition,
} from "../types";

export interface MongoAdapterOptions {
    client: MongoClient;
    dbName: string;
    unitCollectionName?: string;
    unitTypeCollectionName?: string;
}

const DEFAULT_UNIT_COLLECTION = "units";
const DEFAULT_UNIT_TYPE_COLLECTION = "unitTypes";

export class MongoDatabaseAdapter implements CrystalDatabaseAdapter {
    private readonly db: Db;
    private readonly unitsCollection: Collection<StoredUnitDocument>;
    private readonly unitTypesCollection: Collection<StoredUnitType>;

    constructor(options: MongoAdapterOptions) {
        this.db = options.client.db(options.dbName);
        this.unitsCollection = this.db.collection<StoredUnitDocument>(
            options.unitCollectionName ?? DEFAULT_UNIT_COLLECTION
        );
        this.unitTypesCollection = this.db.collection<StoredUnitType>(
            options.unitTypeCollectionName ?? DEFAULT_UNIT_TYPE_COLLECTION
        );
    }

    async initialize(): Promise<void> {
        await Promise.all([
            this.unitTypesCollection.createIndex({ id: 1 }, { unique: true }),
            this.unitsCollection.createIndex({ id: 1 }, { unique: true }),
            this.unitsCollection.createIndex({ type: 1 }),
        ]);
    }

    async upsertUnitType(definition: UnitTypeDefinition, now: Date): Promise<StoredUnitType> {
        const update = {
            $set: {
                documentation: definition.documentation ?? {},
                items: definition.items ?? [],
                metadata: definition.metadata ?? {},
                updatedAt: now,
            },
            $setOnInsert: {
                id: definition.id,
                createdAt: now,
            },
        };

        await this.unitTypesCollection.updateOne({ id: definition.id }, update, { upsert: true });

        const stored = await this.unitTypesCollection.findOne({ id: definition.id });
        if (!stored) {
            throw new Error(`Failed to persist unit type ${definition.id}`);
        }

        return stored;
    }

    async getUnitTypeById(id: string): Promise<StoredUnitType | null> {
        return this.unitTypesCollection.findOne({ id });
    }

    async insertUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitsCollection.insertOne(doc);
    }

    async replaceUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitsCollection.replaceOne({ id: doc.id }, doc);
    }

    async getUnitById(id: string): Promise<StoredUnitDocument | null> {
        return this.unitsCollection.findOne({ id });
    }
}

export const createMongoAdapter = (options: MongoAdapterOptions): MongoDatabaseAdapter => {
    return new MongoDatabaseAdapter(options);
};

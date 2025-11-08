import { Collection, Db, MongoClient } from "mongodb";
import { CrystalDatabaseAdapter, StoredUnitDocument, StoredUnitTypeDocument } from "../types";

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
    private readonly unitTypesCollection: Collection<StoredUnitTypeDocument>;

    constructor(options: MongoAdapterOptions) {
        this.db = options.client.db(options.dbName);
        this.unitsCollection = this.db.collection<StoredUnitDocument>(
            options.unitCollectionName ?? DEFAULT_UNIT_COLLECTION
        );
        this.unitTypesCollection = this.db.collection<StoredUnitTypeDocument>(
            options.unitTypeCollectionName ?? DEFAULT_UNIT_TYPE_COLLECTION
        );
    }

    async initialize(): Promise<void> {
        await Promise.all([
            this.unitTypesCollection.createIndex({ id: 1 }, { unique: true }),
            this.unitTypesCollection.createIndex({ businessId: 1 }, { unique: true }),
            this.unitsCollection.createIndex({ id: 1 }, { unique: true }),
            this.unitsCollection.createIndex({ businessId: 1 }, { unique: true }),
            this.unitsCollection.createIndex({ typeId: 1 }),
        ]);
    }

    async upsertUnitType(document: StoredUnitTypeDocument): Promise<void> {
        await this.unitTypesCollection.replaceOne({ businessId: document.businessId }, document, {
            upsert: true,
        });
    }

    async findUnitTypeByBusinessId(businessId: string): Promise<StoredUnitTypeDocument | null> {
        return this.unitTypesCollection.findOne({ businessId });
    }

    async findUnitTypeById(id: string): Promise<StoredUnitTypeDocument | null> {
        return this.unitTypesCollection.findOne({ id });
    }

    async insertUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitsCollection.insertOne(doc);
    }

    async replaceUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitsCollection.replaceOne({ businessId: doc.businessId }, doc, {
            upsert: true,
        });
    }

    async findUnitByBusinessId(businessId: string): Promise<StoredUnitDocument | null> {
        return this.unitsCollection.findOne({ businessId });
    }

    async findUnitById(id: string): Promise<StoredUnitDocument | null> {
        return this.unitsCollection.findOne({ id });
    }
}

export const createMongoAdapter = (options: MongoAdapterOptions): MongoDatabaseAdapter => {
    return new MongoDatabaseAdapter(options);
};

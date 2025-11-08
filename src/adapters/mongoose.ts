import type { Connection, Model } from "mongoose";
import { Schema } from "mongoose";
import {
    CrystalDatabaseAdapter,
    StoredDataItemDocument,
    StoredUnitDocument,
    StoredUnitTypeDocument,
} from "../types";

export interface MongooseAdapterOptions {
    connection: Connection;
    unitCollectionName?: string;
    unitTypeCollectionName?: string;
}

const DEFAULT_UNIT_COLLECTION = "units";
const DEFAULT_UNIT_TYPE_COLLECTION = "unitTypes";

const createStoredDataItemSchema = (): Schema<StoredDataItemDocument> => {
    return new Schema<StoredDataItemDocument>(
        {
            id: { type: String, required: true },
            businessId: { type: String, required: true },
            type: { type: String, required: true },
            documentation: { type: Schema.Types.Mixed },
            metadata: { type: Schema.Types.Mixed },
        },
        {
            _id: false,
            strict: false,
            minimize: false,
        }
    );
};

const createUnitTypeSchema = (
    collectionName: string,
    storedDataItemSchema: Schema<StoredDataItemDocument>
): Schema<StoredUnitTypeDocument> => {
    const schema = new Schema<StoredUnitTypeDocument>(
        {
            id: { type: String, required: true },
            businessId: { type: String, required: true },
            documentation: { type: Schema.Types.Mixed, required: true },
            items: { type: [storedDataItemSchema], default: [] },
            metadata: { type: Schema.Types.Mixed },
            createdAt: { type: Date, required: true },
            updatedAt: { type: Date, required: true },
        },
        {
            collection: collectionName,
            versionKey: false,
            strict: false,
            minimize: false,
        }
    );

    schema.index({ id: 1 }, { unique: true });
    schema.index({ businessId: 1 }, { unique: true });

    return schema;
};

const createUnitSchema = (collectionName: string): Schema<StoredUnitDocument> => {
    const schema = new Schema<StoredUnitDocument>(
        {
            id: { type: String, required: true },
            businessId: { type: String, required: true },
            typeId: { type: String, required: true },
            values: { type: Schema.Types.Mixed, required: true },
            metadata: { type: Schema.Types.Mixed },
            createdAt: { type: Date, required: true },
            updatedAt: { type: Date, required: true },
        },
        {
            collection: collectionName,
            versionKey: false,
            strict: false,
            minimize: false,
        }
    );

    schema.index({ id: 1 }, { unique: true });
    schema.index({ businessId: 1 }, { unique: true });
    schema.index({ typeId: 1 });

    return schema;
};

const getOrCreateModel = <T>(
    connection: Connection,
    modelName: string,
    schema: Schema<T>
): Model<T> => {
    if (connection.models[modelName]) {
        return connection.model<T>(modelName);
    }

    return connection.model<T>(modelName, schema);
};

export class MongooseDatabaseAdapter implements CrystalDatabaseAdapter {
    private readonly unitModel: Model<StoredUnitDocument>;
    private readonly unitTypeModel: Model<StoredUnitTypeDocument>;

    constructor(options: MongooseAdapterOptions) {
        const unitCollectionName = options.unitCollectionName ?? DEFAULT_UNIT_COLLECTION;
        const unitTypeCollectionName =
            options.unitTypeCollectionName ?? DEFAULT_UNIT_TYPE_COLLECTION;

        const storedDataItemSchema = createStoredDataItemSchema();
        const unitTypeSchema = createUnitTypeSchema(unitTypeCollectionName, storedDataItemSchema);
        const unitSchema = createUnitSchema(unitCollectionName);

        const unitModelName = `CrystalUnit_${unitCollectionName}`;
        const unitTypeModelName = `CrystalUnitType_${unitTypeCollectionName}`;

        this.unitModel = getOrCreateModel(options.connection, unitModelName, unitSchema);
        this.unitTypeModel = getOrCreateModel(options.connection, unitTypeModelName, unitTypeSchema);
    }

    async initialize(): Promise<void> {
        await Promise.all([this.unitTypeModel.syncIndexes(), this.unitModel.syncIndexes()]);
    }

    async upsertUnitType(document: StoredUnitTypeDocument): Promise<void> {
        await this.unitTypeModel.replaceOne({ businessId: document.businessId }, document, {
            upsert: true,
        });
    }

    async findUnitTypeByBusinessId(
        businessId: string
    ): Promise<StoredUnitTypeDocument | null> {
        return this.unitTypeModel.findOne({ businessId }).lean<StoredUnitTypeDocument>().exec();
    }

    async findUnitTypeById(id: string): Promise<StoredUnitTypeDocument | null> {
        return this.unitTypeModel.findOne({ id }).lean<StoredUnitTypeDocument>().exec();
    }

    async insertUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitModel.create(doc);
    }

    async replaceUnit(doc: StoredUnitDocument): Promise<void> {
        await this.unitModel.replaceOne({ businessId: doc.businessId }, doc, {
            upsert: true,
        });
    }

    async findUnitByBusinessId(businessId: string): Promise<StoredUnitDocument | null> {
        return this.unitModel.findOne({ businessId }).lean<StoredUnitDocument>().exec();
    }

    async findUnitById(id: string): Promise<StoredUnitDocument | null> {
        return this.unitModel.findOne({ id }).lean<StoredUnitDocument>().exec();
    }
}

export const createMongooseAdapter = (options: MongooseAdapterOptions): MongooseDatabaseAdapter => {
    return new MongooseDatabaseAdapter(options);
};


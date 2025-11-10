import { Collection, Db, Filter, MongoClient } from "mongodb";
import {
    CrystalDatabaseAdapter,
    QueryFilterValue,
    QueryProjection,
    StoredUnitDocument,
    StoredUnitTypeDocument,
    UnitListQuery,
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

    async listUnits(query: UnitListQuery): Promise<StoredUnitDocument[]> {
        const mongoFilter = this.buildMongoFilter(query);
        const projection = this.buildProjection(query.fields);
        const cursor = this.unitsCollection.find(mongoFilter, {
            projection,
        });

        const sort = this.buildSort(query.order);
        if (sort) {
            cursor.sort(sort);
        }

        if (typeof query.offset === "number" && query.offset > 0) {
            cursor.skip(query.offset);
        }

        if (typeof query.limit === "number" && query.limit > 0) {
            cursor.limit(query.limit);
        }

        return cursor.toArray();
    }

    private buildMongoFilter(query: UnitListQuery): Filter<StoredUnitDocument> {
        const filter: Filter<StoredUnitDocument> = {
            typeId: query.typeId,
        };

        if (query.filters) {
            for (const [path, condition] of Object.entries(query.filters)) {
                (filter as Record<string, unknown>)[path] = this.normalizeFilterValue(condition);
            }
        }

        if (query.search && query.search.trim().length > 0) {
            const regex = new RegExp(query.search.trim(), "i");
            filter.$or = [
                ...(filter.$or ?? []),
                { businessId: regex },
                { id: regex },
            ];
        }

        return filter;
    }

    private normalizeFilterValue(filter: QueryFilterValue): unknown {
        const operator = filter.operator ?? "eq";
        const { value } = filter;

        if (operator === "eq") {
            return value;
        }

        let normalizedValue = value;
        if ((operator === "in" || operator === "nin") && !Array.isArray(value)) {
            normalizedValue = [value];
        }

        if (operator === "regex" && typeof value === "string") {
            normalizedValue = new RegExp(value, "i");
        }

        return {
            [`$${operator}`]: normalizedValue,
        };
    }

    private buildSort(
        order: UnitListQuery["order"]
    ): Record<string, 1 | -1> | undefined {
        if (!order || Object.keys(order).length === 0) {
            return undefined;
        }

        const sort: Record<string, 1 | -1> = {};
        for (const [path, direction] of Object.entries(order)) {
            sort[path] = direction === "desc" ? -1 : 1;
        }
        return sort;
    }

    private buildProjection(fields?: QueryProjection): Record<string, 0 | 1> | undefined {
        if (!fields) {
            return undefined;
        }

        const projection: Record<string, 0 | 1> = {};
        for (const [path, value] of Object.entries(fields)) {
            projection[path] = value ? 1 : 0;
        }

        for (const mandatory of [
            "id",
            "businessId",
            "typeId",
            "values",
            "metadata",
            "createdAt",
            "updatedAt",
        ]) {
            projection[mandatory] = 1;
        }

        return projection;
    }
}

export const createMongoAdapter = (options: MongoAdapterOptions): MongoDatabaseAdapter => {
    return new MongoDatabaseAdapter(options);
};

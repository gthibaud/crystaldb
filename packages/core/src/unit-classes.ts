import type { Unit, UnitMetadata, UnitTypeDefinition, UnitValue, UnitValues } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnitClassConstructor<TInstance> = new (...args: any[]) => TInstance;

export interface UnitClassInstance<TValues extends UnitValues = UnitValues> {
    id?: string;
    unitTypeId?: string;
    values: TValues;
    metadata?: UnitMetadata;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface UnitClassExtraction {
    id?: string;
    unitTypeId: string;
    values: UnitValues;
    metadata?: UnitMetadata;
}

export interface UnitClassAccessorMap<TInstance, TValues extends UnitValues = UnitValues> {
    getValues?(instance: TInstance): TValues | undefined;
    setValues?(instance: TInstance, values: TValues): void;
    getMetadata?(instance: TInstance): UnitMetadata | undefined;
    setMetadata?(instance: TInstance, metadata: UnitMetadata | undefined): void;
    getId?(instance: TInstance): string | undefined;
    setId?(instance: TInstance, id: string | undefined): void;
    getUnitTypeId?(instance: TInstance): string | undefined;
    setUnitTypeId?(instance: TInstance, unitTypeId: string): void;
    getCreatedAt?(instance: TInstance): Date | undefined;
    setCreatedAt?(instance: TInstance, createdAt: Date): void;
    getUpdatedAt?(instance: TInstance): Date | undefined;
    setUpdatedAt?(instance: TInstance, updatedAt: Date): void;
}

export interface RegisterUnitTypeClassOptions<TInstance, TValues extends UnitValues = UnitValues> {
    definition: UnitTypeDefinition;
    ctor: UnitClassConstructor<TInstance>;
    map?: UnitClassAccessorMap<TInstance, TValues>;
    defineProperties?: boolean;
    replace?: boolean;
}

interface EffectiveAccessors<TInstance, TValues extends UnitValues = UnitValues> {
    getValues(instance: TInstance): TValues;
    setValues(instance: TInstance, values: TValues): void;
    getMetadata(instance: TInstance): UnitMetadata | undefined;
    setMetadata(instance: TInstance, metadata: UnitMetadata | undefined): void;
    getId(instance: TInstance): string | undefined;
    setId(instance: TInstance, id: string | undefined): void;
    getUnitTypeId(instance: TInstance): string | undefined;
    setUnitTypeId(instance: TInstance, unitTypeId: string): void;
    getCreatedAt(instance: TInstance): Date | undefined;
    setCreatedAt(instance: TInstance, createdAt: Date): void;
    getUpdatedAt(instance: TInstance): Date | undefined;
    setUpdatedAt(instance: TInstance, updatedAt: Date): void;
}

interface UnitClassBinding<TInstance, TValues extends UnitValues = UnitValues>
    extends EffectiveAccessors<TInstance, TValues> {
    definition: UnitTypeDefinition;
    ctor: UnitClassConstructor<TInstance>;
    instantiate(unit: Unit): TInstance;
    applyToInstance(unit: Unit, instance: TInstance): void;
    extract(instance: TInstance): UnitClassExtraction;
}

const UNIT_CLASS_BINDING_SYMBOL = Symbol.for("crystaldb.unitClass.binding");
const UNIT_CLASS_INSTANCE_SYMBOL = Symbol.for("crystaldb.unitClass.instance");

const bindingByUnitType = new Map<string, UnitClassBinding<unknown>>();
const bindingByConstructor = new WeakMap<
    UnitClassConstructor<unknown>,
    UnitClassBinding<unknown>
>();

const globalStructuredClone: (<T>(value: T) => T) | undefined = (() => {
    const candidate = (globalThis as { structuredClone?: <T>(value: T) => T }).structuredClone;
    return typeof candidate === "function" ? candidate : undefined;
})();

const cloneDeep = <T>(value: T): T => {
    if (value === undefined) {
        return value;
    }

    if (globalStructuredClone) {
        return globalStructuredClone(value);
    }

    return JSON.parse(JSON.stringify(value)) as T;
};

const ensureValuesCollection = <TInstance, TValues extends UnitValues>(
    instance: TInstance,
    binding: EffectiveAccessors<TInstance, TValues>
): TValues => {
    const current = binding.getValues(instance);
    if (current && typeof current === "object") {
        return current;
    }
    const fresh = {} as TValues;
    binding.setValues(instance, fresh);
    return fresh;
};

const buildEffectiveAccessors = <TInstance, TValues extends UnitValues>(
    map: UnitClassAccessorMap<TInstance, TValues> | undefined
): EffectiveAccessors<TInstance, TValues> => {
    const setValues =
        map?.setValues ??
        ((instance: TInstance, values: TValues) => {
            (instance as unknown as UnitClassInstance<TValues>).values = values;
        });

    const getValues = (instance: TInstance): TValues => {
        const provided = map?.getValues
            ? map.getValues(instance)
            : (instance as unknown as UnitClassInstance<TValues>).values;

        if (provided && typeof provided === "object") {
            return provided;
        }

        const fresh = {} as TValues;
        setValues(instance, fresh);
        return fresh;
    };

    const getMetadata =
        map?.getMetadata ??
        ((instance: TInstance) => (instance as unknown as UnitClassInstance<TValues>).metadata);
    const setMetadata =
        map?.setMetadata ??
        ((instance: TInstance, metadata: UnitMetadata | undefined) => {
            (instance as unknown as UnitClassInstance<TValues>).metadata = metadata;
        });

    const getId =
        map?.getId ??
        ((instance: TInstance) => (instance as unknown as UnitClassInstance<TValues>).id);
    const setId =
        map?.setId ??
        ((instance: TInstance, id: string | undefined) => {
            (instance as unknown as UnitClassInstance<TValues>).id = id;
        });

    const getUnitTypeId =
        map?.getUnitTypeId ??
        ((instance: TInstance) => (instance as unknown as UnitClassInstance<TValues>).unitTypeId);
    const setUnitTypeId =
        map?.setUnitTypeId ??
        ((instance: TInstance, unitTypeId: string) => {
            (instance as unknown as UnitClassInstance<TValues>).unitTypeId = unitTypeId;
        });

    const getCreatedAt =
        map?.getCreatedAt ??
        ((instance: TInstance) => (instance as unknown as UnitClassInstance<TValues>).createdAt);
    const setCreatedAt =
        map?.setCreatedAt ??
        ((instance: TInstance, createdAt: Date) => {
            (instance as unknown as UnitClassInstance<TValues>).createdAt = createdAt;
        });

    const getUpdatedAt =
        map?.getUpdatedAt ??
        ((instance: TInstance) => (instance as unknown as UnitClassInstance<TValues>).updatedAt);
    const setUpdatedAt =
        map?.setUpdatedAt ??
        ((instance: TInstance, updatedAt: Date) => {
            (instance as unknown as UnitClassInstance<TValues>).updatedAt = updatedAt;
        });

    return {
        getValues,
        setValues,
        getMetadata,
        setMetadata,
        getId,
        setId,
        getUnitTypeId,
        setUnitTypeId,
        getCreatedAt,
        setCreatedAt,
        getUpdatedAt,
        setUpdatedAt,
    };
};

const markPrototypeWithBinding = (prototype: object, binding: UnitClassBinding<unknown>): void => {
    Object.defineProperty(prototype, UNIT_CLASS_BINDING_SYMBOL, {
        value: binding,
        enumerable: false,
        configurable: true,
        writable: false,
    });
};

const markInstance = (instance: object): void => {
    if (UNIT_CLASS_INSTANCE_SYMBOL in instance) {
        return;
    }
    Object.defineProperty(instance, UNIT_CLASS_INSTANCE_SYMBOL, {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false,
    });
};

const defineValueProperties = <TInstance, TValues extends UnitValues>(
    prototype: object,
    binding: UnitClassBinding<TInstance, TValues>
): void => {
    for (const item of binding.definition.items) {
        if (Object.prototype.hasOwnProperty.call(prototype, item.id)) {
            continue;
        }

        Object.defineProperty(prototype, item.id, {
            configurable: true,
            enumerable: true,
            get(this: TInstance) {
                const values = ensureValuesCollection(this, binding) as UnitValues;
                return values[item.id];
            },
            set(this: TInstance, value: UnitValue | undefined) {
                const values = ensureValuesCollection(this, binding) as UnitValues;
                if (value === undefined) {
                    delete values[item.id];
                } else {
                    values[item.id] = value;
                }
            },
        });
    }
};

const buildBinding = <TInstance, TValues extends UnitValues>(
    options: RegisterUnitTypeClassOptions<TInstance, TValues>
): UnitClassBinding<TInstance, TValues> => {
    const accessors = buildEffectiveAccessors(options.map);

    const instantiate = (unit: Unit): TInstance => {
        const instance = new options.ctor() as TInstance;
        accessors.setUnitTypeId(instance, unit.unitTypeId);
        accessors.setId(instance, unit.id);
        accessors.setValues(instance, cloneDeep(unit.values) as TValues);
        accessors.setMetadata(instance, cloneDeep(unit.metadata));
        accessors.setCreatedAt(instance, unit.createdAt);
        accessors.setUpdatedAt(instance, unit.updatedAt);
        markInstance(instance as unknown as object);
        return instance;
    };

    const applyToInstance = (unit: Unit, instance: TInstance): void => {
        accessors.setUnitTypeId(instance, unit.unitTypeId);
        accessors.setId(instance, unit.id);
        accessors.setValues(instance, cloneDeep(unit.values) as TValues);
        accessors.setMetadata(instance, cloneDeep(unit.metadata));
        accessors.setCreatedAt(instance, unit.createdAt);
        accessors.setUpdatedAt(instance, unit.updatedAt);
        markInstance(instance as unknown as object);
    };

    const extract = (instance: TInstance): UnitClassExtraction => {
        const unitTypeId = accessors.getUnitTypeId(instance) ?? options.definition.id;
        const values = cloneDeep(accessors.getValues(instance));
        const metadata = cloneDeep(accessors.getMetadata(instance));
        const id = accessors.getId(instance);

        return {
            id,
            unitTypeId,
            values,
            metadata,
        };
    };

    return {
        definition: options.definition,
        ctor: options.ctor,
        instantiate,
        applyToInstance,
        extract,
        ...accessors,
    };
};

const getBindingFromPrototype = (
    prototype: object | null
): UnitClassBinding<unknown> | undefined => {
    if (!prototype) {
        return undefined;
    }
    const binding = (prototype as Record<PropertyKey, unknown>)[UNIT_CLASS_BINDING_SYMBOL];
    if (binding && typeof binding === "object") {
        return binding as UnitClassBinding<unknown>;
    }
    return getBindingFromPrototype(Object.getPrototypeOf(prototype));
};

export const registerUnitTypeClass = <TInstance, TValues extends UnitValues = UnitValues>(
    options: RegisterUnitTypeClassOptions<TInstance, TValues>
): void => {
    if (!options?.definition) {
        throw new Error("registerUnitTypeClass requires a unit type definition");
    }
    if (typeof options.definition.id !== "string" || options.definition.id.length === 0) {
        throw new Error("Unit type definition id must be a non-empty string");
    }
    if (typeof options.ctor !== "function") {
        throw new Error("registerUnitTypeClass expects a constructor function");
    }

    const replace = options.replace === true;
    if (!replace && bindingByUnitType.has(options.definition.id)) {
        throw new Error(`A class is already registered for unit type "${options.definition.id}"`);
    }

    const binding = buildBinding(options);

    bindingByUnitType.set(options.definition.id, binding);
    bindingByConstructor.set(options.ctor, binding);
    markPrototypeWithBinding(options.ctor.prototype, binding);

    if (options.defineProperties !== false) {
        defineValueProperties(options.ctor.prototype, binding);
    }
};

export const unregisterUnitTypeClass = (unitTypeId: string): void => {
    const binding = bindingByUnitType.get(unitTypeId);
    if (!binding) {
        return;
    }

    bindingByUnitType.delete(unitTypeId);
    bindingByConstructor.delete(binding.ctor);
};

export const getRegisteredUnitTypeClassById = (
    unitTypeId: string
): UnitClassBindingHandle<unknown> | undefined => {
    return bindingByUnitType.get(unitTypeId);
};

export const getRegisteredUnitTypeClassByConstructor = <TInstance>(
    ctor: UnitClassConstructor<TInstance>
): UnitClassBindingHandle<TInstance> | undefined => {
    return bindingByConstructor.get(ctor) as UnitClassBinding<TInstance> | undefined;
};

export const getRegisteredUnitTypeClassForInstance = (
    instance: unknown
): UnitClassBindingHandle<unknown> | undefined => {
    if (!instance || (typeof instance !== "object" && typeof instance !== "function")) {
        return undefined;
    }
    return getBindingFromPrototype(Object.getPrototypeOf(instance));
};

export const isUnitClassInstance = (value: unknown): value is UnitClassInstance => {
    if (!value || typeof value !== "object") {
        return false;
    }
    if ((value as Record<PropertyKey, unknown>)[UNIT_CLASS_INSTANCE_SYMBOL]) {
        return true;
    }
    return getRegisteredUnitTypeClassForInstance(value) !== undefined;
};

export const instantiateUnitClass = <TInstance>(unit: Unit): TInstance | Unit => {
    const binding = getRegisteredUnitTypeClassById(unit.unitTypeId) as
        | UnitClassBinding<TInstance>
        | undefined;
    if (!binding) {
        return unit;
    }
    return binding.instantiate(unit);
};

export const applyUnitToClassInstance = <TInstance>(unit: Unit, instance: TInstance): TInstance => {
    const binding = getRegisteredUnitTypeClassForInstance(instance) as
        | UnitClassBinding<TInstance>
        | undefined;
    if (!binding) {
        throw new Error("Instance is not associated with a registered unit type class");
    }
    binding.applyToInstance(unit, instance);
    return instance;
};

export const extractClassInstanceData = (instance: unknown): UnitClassExtraction | undefined => {
    const binding = getRegisteredUnitTypeClassForInstance(instance);
    if (!binding) {
        return undefined;
    }
    return binding.extract(instance);
};

export const getUnitTypeDefinitionForClass = <TInstance>(
    ctor: UnitClassConstructor<TInstance>
): UnitTypeDefinition | undefined => {
    const binding = getRegisteredUnitTypeClassByConstructor(ctor);
    return binding?.definition;
};

export type { UnitClassConstructor };
export type UnitClassBindingHandle<
    TInstance,
    TValues extends UnitValues = UnitValues,
> = UnitClassBinding<TInstance, TValues>;

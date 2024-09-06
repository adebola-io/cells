/**
 * @template {*} T
 */
export class Cell<T extends unknown> {
    /**
     * Adds a global effect that runs before any Cell is updated.
     * @param {(value: unknown) => void} effect - The effect function.
     * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - The options for the effect.
     * @example
     * ```
     * import { Cell } from '@adbl/cells';
     *
     * const cell = Cell.source(0);
     * Cell.beforeUpdate((value) => console.log(value));
     *
     * cell.value = 1; // prints 1
     * cell.value = 2; // prints 2
     * ```
     */
    static beforeUpdate: (effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined) => void;
    /**
     * Adds a global post-update effect to the Cell system.
     * @param {(value: unknown) => void} effect - The effect function to add.
     * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - Options for the effect.
     * @example
     * ```
     * import { Cell } from '@adbl/cells';
     *
     * const effect = (value) => console.log(value);
     * Cell.afterUpdate(effect);
     *
     * const cell = Cell.source(0);
     * cell.value = 1; // prints 1
     * ```
     */
    static afterUpdate: (effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined) => void;
    static removeGlobalEffects: () => void;
    /**
     * Removes a global effect.
     * @param {(value: unknown) => void} effect - The effect function added previously.
     * @example
     * ```
     * import { Cell } from '@adbl/cells';
     *
     * const effect = (value) => console.log(value);
     * Cell.beforeUpdate(effect);
     *
     * const cell = Cell.source(0);
     * cell.value = 1; // prints 1
     *
     * Cell.removeGlobalEffect(effect);
     *
     * cell.value = 2; // prints nothing
     * ```
     */
    static removeGlobalEffect: (effect: (value: unknown) => void) => void;
    /**
     * @template T
     * Creates a new Cell instance with the provided value.
     * @param {T} value - The value to be stored in the Cell.
     * @param {Partial<CellOptions<T>>} [options] - The options for the cell.
     * @returns {SourceCell<T>} A new Cell instance.
     * ```
     * import { Cell } from '@adbl/cells';
     *
     * const cell = Cell.source('Hello world');
     * console.log(cell.value); // Hello world.
     *
     * cell.value = 'Greetings!';
     * console.log(cell.value) // Greetings!
     * ```
     */
    static source: <T_1>(value: T_1, options?: Partial<CellOptions<T_1>> | undefined) => SourceCell<T_1>;
    /**
     * @template T
     * Creates a new Derived instance with the provided callback function.
     * @param {() => T} callback - The callback function to be used by the Derived instance.
     * @returns {DerivedCell<T>} A new Derived instance.
     * ```
     * import { Cell } from '@adbl/cells';
     *
     * const cell = Cell.source(2);
     * const derived = Cell.derived(() => cell.value * 2);
     *
     * console.log(derived.value); // 4
     *
     * cell.value = 3;
     * console.log(derived.value); // 6
     * ```
     */
    static derived: <T_2>(callback: () => T_2) => DerivedCell<T_2>;
    /**
     * Batches all the effects created to run only once.
     * @param {() => void} callback - The function to be executed in a batched manner.
     */
    static batch: (callback: () => void) => void;
    /**
     * Checks if the provided value is an instance of the Cell class.
     * @template [T=any]
     * @template [U=any]
     * @param {Cell<T> | U} value - The value to check.
     * @returns {value is Cell<T>} True if the value is an instance of Cell, false otherwise.
     */
    static isCell: <T_3 = any, U = any>(value: U | Cell<T_3>) => value is Cell<T_3>;
    /**
     * @template T
     * Flattens the provided value by returning the value if it is not a Cell instance, or the value of the Cell instance if it is.
     * @param {T | Cell<T>} value - The value to be flattened.
     * @returns {T} The flattened value.
     */
    static flatten: <T_4>(value: T_4 | Cell<T_4>) => T_4;
    /**
     * Flattens an array by applying the `flatten` function to each element.
     * @template T
     * @param {Array<T | Cell<T>>} array - The array to be flattened.
     * @returns {Array<T>} A new array with the flattened elements.
     */
    static flattenArray: <T_5>(array: (T_5 | Cell<T_5>)[]) => T_5[];
    /**
     * Flattens an object by applying the `flatten` function to each value.
     * @template {object} T
     * @param {T} object - The object to be flattened.
     * @returns {{ [K in keyof T]: T[K] extends Cell<infer U> ? U : T[K] }} A new object with the flattened values.
     */
    static flattenObject: <T_6 extends object>(object: T_6) => { [K in keyof T_6]: T_6[K] extends Cell<infer U_1 extends unknown> ? U_1 : T_6[K]; };
    /**
     * Wraps an asynchronous function with managed state.
     *
     * @template X - The type of the input parameter for the getter function.
     * @template Y - The type of the output returned by the getter function.
     * @param {(input: X) => Promise<Y>} getter - A function that performs the asynchronous operation.
     * @returns {AsyncRequestAtoms<X, Y>} An object containing cells for pending, data, and error states,
     *          as well as functions to run and reload the operation.
     *
     * @example
     * const { pending, data, error, run, reload } = Cell.async(async (input) => {
     *   const response = await fetch(`https://example.com/api/data?input=${input}`);
     *   return response.json();
     * });
     *
     * run('input');
     */
    static async<X, Y>(getter: (input: X) => Promise<Y>): AsyncRequestAtoms<X, Y>;
    /**
     * @readonly
     * @returns {Array<DerivedCell<any>>}
     */
    readonly get derivedCells(): DerivedCell<any>[];
    /**
     * @protected @type T
     */
    protected wvalue: T;
    /**
     * @protected
     * @param {T} value
     */
    protected setValue(value: T): void;
    /**
     * Overrides `Object.prototype.valueOf()` to return the value stored in the Cell.
     * @returns {T} The value of the Cell.
     */
    valueOf(): T;
    get value(): T;
    /**
     * Stringifies the value of the Cell.
     * @returns {string}
     */
    toString(): string;
    /**
     * The value stored in the Cell.
     * @protected @type {T}
     */
    protected get revalued(): T;
    /**
     * Adds the provided effect callback to the list of effects for this cell, and returns a function that can be called to remove the effect.
     * @param {(newValue: T) => void} callback - The effect callback to add.
     * @param {EffectOptions} [options] - The options for the effect.
     * @returns {() => void} A function that can be called to remove the effect.
     */
    listen(callback: (newValue: T) => void, options?: EffectOptions | undefined): () => void;
    /**
     * Creates an effect that is immediately executed with the current value of the cell, and then added to the list of effects for the cell.
     * @param {(newValue: T) => void} callback - The effect callback to add.
     * @param {Partial<EffectOptions>} [options] - The options for the effect.
     * @returns {() => void} A function that can be called to remove the effect.
     */
    runAndListen(callback: (newValue: T) => void, options?: Partial<EffectOptions> | undefined): () => void;
    /**
     * Removes the specified effect callback from the list of effects for this cell.
     * @param {(newValue: T) => void} callback - The effect callback to remove.
     */
    ignore(callback: (newValue: T) => void): void;
    /**
     * Checks if the cell is listening to a watcher with the specified name.
     * @param {string} name - The name of the watcher to check for.
     * @returns {boolean} `true` if the cell is listening to a watcher with the specified name, `false` otherwise.
     */
    isListeningTo(name: string): boolean;
    /**
     * Removes the watcher with the specified name from the list of effects for this cell.
     * @param {string} name - The name of the watcher to stop listening to.
     */
    stopListeningTo(name: string): void;
    /**
     * Updates the root object and notifies any registered watchers and computed dependents.
     * This method is called whenever the root object's value changes.
     */
    update(): void;
    /**
     * Returns the current value of the cell without registering a watcher.
     * @returns {T} - The current value of the cell.
     */
    peek(): T;
    #private;
}
/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template {*} T
 * @extends {Cell<T>}
 */
export class DerivedCell<T extends unknown> extends Cell<T> {
    /**
     * @param {() => T} computedFn - A function that generates the value of the computed.
     */
    constructor(computedFn: () => T);
    /**
     * @readonly
     */
    readonly set value(_: T);
    /**
     * @readonly
     */
    readonly get value(): T;
}
/**
 * @template {*} T
 * @extends {Cell<T>}
 */
export class SourceCell<T extends unknown> extends Cell<T> {
    /**
     * Creates a new Cell with the provided value.
     * @param {T} value
     * @param {Partial<CellOptions<T>>} [options]
     */
    constructor(value: T, options?: Partial<CellOptions<T>> | undefined);
    /** @type {Partial<CellOptions<T>>} */
    options: Partial<CellOptions<T>>;
    /**
     * For cells containing objects, returns the object itself.
     * This can be useful in scenarios where unfettered access to the original object is needed,
     * such as when using the object as a cache.
     *
     * @example
     * const cell = new SourceCell({ a: 1, b: 2 });
     * console.log(cell.originalObject); // { a: 1, b: 2 }
     *
     * cell.value = { a: 3, b: 4 };
     * console.log(cell.originalObject); // { a: 3, b: 4 }
     *
     * @returns {T extends object ? T : never} The original object if T is an object, otherwise never.
     */
    deproxy(): T extends object ? T : never;
    /**
     * Sets the value stored in the Cell and triggers an update.
     * @param {T} value
     */
    set value(value: T);
    get value(): T;
    #private;
}
export type AsyncRequestAtoms<Input, Output> = {
    /**
     * Represents the loading state of an asynchronous request.
     */
    pending: SourceCell<boolean>;
    /**
     * Represents the data returned by the asynchronous request.
     */
    data: SourceCell<Output | null>;
    /**
     * Represents the errors returned by the asynchronous request, if any.
     */
    error: SourceCell<Error | null>;
    /**
     * Triggers the asynchronous request.
     */
    run: NeverIfAny<Input> extends never ? (input?: Input) => Promise<void> : (input: Input) => Promise<void>;
    /**
     * Triggers the asynchronous request again with an optional new input and optionally changes the loading state.
     */
    reload: (newInput?: Input, changeLoadingState?: boolean) => Promise<void>;
};
export type EffectOptions = {
    /**
     * Whether the effect should be removed after the first run.
     */
    once?: boolean | undefined;
    /**
     * An AbortSignal to be used to ignore the effect if it is aborted.
     */
    signal?: AbortSignal | undefined;
    /**
     * The name of the effect for debugging purposes.
     */
    name?: string | undefined;
    /**
     * Whether the effect should be weakly referenced. This means that the effect will be garbage collected if there are no other references to it.
     */
    weak?: boolean | undefined;
    /**
     * The priority of the effect. Higher priority effects are executed first. The default priority is 0.
     */
    priority?: number | undefined;
};
export type CellOptions<T> = {
    /**
     * Whether the cell should be immutable. If set to true, the cell will not allow updates and will throw an error if the value is changed.
     */
    immutable?: boolean | undefined;
    /**
     * Whether the cell should watch for changes deep into the given value. By default the cell only reacts to changes at the top level.
     */
    deep?: boolean | undefined;
    /**
     * A function that determines whether two values are equal. If not provided, the default equality function will be used.
     */
    equals?: ((oldValue: T, newValue: T) => boolean) | undefined;
};
export type NeverIfAny<T> = 0 extends (1 & T) ? never : T;
export type Reference<T> = {
    deref: () => T | undefined;
};

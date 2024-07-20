/**
 * @template T
 */
export class Signal<T> {
    /**
     * Adds a global effect that runs before any Signal is updated.
     * @param {(value: unknown) => void} effect - The effect function.
     * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - The options for the effect.
     * @example
     * ```
     * import { Signal } from '@adbl/signals';
     *
     * const signal = Signal.source(0);
     * Signal.beforeUpdate((value) => console.log(value));
     *
     * signal.value = 1; // prints 1
     * signal.value = 2; // prints 2
     * ```
     */
    static beforeUpdate: (effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined) => void;
    /**
     * Adds a global post-update effect to the Signal system.
     * @param {(value: unknown) => void} effect - The effect function to add.
     * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - Options for the effect.
     * @example
     * ```
     * import { Signal } from '@adbl/signals';
     *
     * const effect = (value) => console.log(value);
     * Signal.afterUpdate(effect);
     *
     * const signal = Signal.source(0);
     * signal.value = 1; // prints 1
     * ```
     */
    static afterUpdate: (effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined) => void;
    static removeGlobalEffects: () => void;
    /**
     * Removes a global effect.
     * @param {(value: unknown) => void} effect - The effect function added previously.
     * @example
     * ```
     * import { Signal } from '@adbl/signals';
     *
     * const effect = (value) => console.log(value);
     * Signal.beforeUpdate(effect);
     *
     * const signal = Signal.source(0);
     * signal.value = 1; // prints 1
     *
     * Signal.removeGlobalEffect(effect);
     *
     * signal.value = 2; // prints nothing
     * ```
     */
    static removeGlobalEffect: (effect: (value: unknown) => void) => void;
    /**
     * @template T
     * Creates a new Signal instance with the provided value.
     * @param {T} value - The value to be stored in the Signal.
     * @returns {SourceSignal<T>} A new Signal instance.
     * ```
     * import { Signal } from '@adbl/signals';
     *
     * const signal = Signal.source('Hello world');
     * console.log(signal.value); // Hello world.
     *
     * signal.value = 'Greetings!';
     * console.log(signal.value) // Greetings!
     * ```
     */
    static source: <T_1>(value: T_1) => SourceSignal<T_1>;
    /**
     * @template T
     * Creates a new Derived instance with the provided callback function.
     * @param {() => T} callback - The callback function to be used by the Derived instance.
     * @returns {DerivedSignal<T>} A new Derived instance.
     * ```
     * import { Signal } from '@adbl/signals';
     *
     * const signal = Signal.source(2);
     * const derived = Signal.derived(() => signal.value * 2);
     *
     * console.log(derived.value); // 4
     *
     * signal.value = 3;
     * console.log(derived.value); // 6
     * ```
     */
    static derived: <T_2>(callback: () => T_2) => DerivedSignal<T_2>;
    /**
     * Batches all the effects created to run only once.
     * @param {() => void} callback - The function to be executed in a batched manner.
     */
    static batch: (callback: () => void) => void;
    /**
     * Checks if the provided value is an instance of the Signal class.
     * @param {any} value - The value to check.
     * @returns {value is Signal<any>} True if the value is an instance of Signal, false otherwise.
     */
    static isSignal: (value: any) => value is Signal<any>;
    /**
     * @template T
     * Flattens the provided value by returning the value if it is not a Signal instance, or the value of the Signal instance if it is.
     * @param {T | Signal<T>} value - The value to be flattened.
     * @returns {T} The flattened value.
     */
    static flatten: <T_3>(value: T_3 | Signal<T_3>) => T_3;
    /**
     * Flattens an array by applying the `flatten` function to each element.
     * @template T
     * @param {Array<T | Signal<T>>} array - The array to be flattened.
     * @returns {Array<T>} A new array with the flattened elements.
     */
    static flattenArray: <T_4>(array: (T_4 | Signal<T_4>)[]) => T_4[];
    /**
     * Flattens an object by applying the `flatten` function to each value.
     * @template {object} T
     * @param {T} object - The object to be flattened.
     * @returns {{ [K in keyof T]: T[K] extends Signal<infer U> ? U : T[K] }} A new object with the flattened values.
     */
    static flattenObject: <T_5 extends object>(object: T_5) => { [K in keyof T_5]: T_5[K] extends Signal<infer U> ? U : T_5[K]; };
    /**
     * Wraps an asynchronous function with managed state.
     *
     * @template X - The type of the input parameter for the getter function.
     * @template Y - The type of the output returned by the getter function.
     * @param {(input: X) => Promise<Y>} getter - A function that performs the asynchronous operation.
     * @returns {AsyncRequestAtoms<X, Y>} An object containing signals for pending, data, and error states,
     *          as well as functions to run and reload the operation.
     *
     * @example
     * const { pending, data, error, run, reload } = Signal.async(async (input) => {
     *   const response = await fetch(`https://example.com/api/data?input=${input}`);
     *   return response.json();
     * });
     *
     * run('input');
     */
    static async<X, Y>(getter: (input: X) => Promise<Y>): AsyncRequestAtoms<X, Y>;
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
     * Overrides `Object.prototype.valueOf()` to return the value stored in the Signal.
     * @returns {T} The value of the Signal.
     */
    valueOf(): T;
    /**
     * The value stored in the Signal.
     * @protected @type {T}
     */
    protected get revalued(): T;
    /**
     * Subscribes the provided effect function to the root's watcher list.
     * If the current instance does not have a watcher list, a new one is created.
     * Returns a function that can be used to unsubscribe the effect.
     *
     * @param {(newValue: T) => void} effect - The effect function to subscribe.
     * @returns {() => void} - A function that can be used to unsubscribe the effect.
     */
    createEffect(effect: (newValue: T) => void): () => void;
    /**
     * Subscribes the provided effect function to the root's watcher list and immediately runs the effect with the current value.
     * If the current instance does not have a watcher list, a new one is created.
     * Returns a function that can be used to unsubscribe the effect.
     *
     * @param {(newValue: T) => void} effect - The effect function to subscribe and immediately run.
     * @returns {() => void} - A function that can be used to unsubscribe the effect.
     */
    createImmediateEffect(effect: (newValue: T) => void): () => void;
    /**
     * Unsubscribes the provided effect from the root watcher list.
     *
     * @param {(newValue: T) => void} effect - The effect function to unsubscribe.
     */
    removeEffect(effect: (newValue: T) => void): void;
    /**
     * Updates the root object and notifies any registered watchers and computed dependents.
     * This method is called whenever the root object's value changes.
     */
    update(): void;
    /**
     * Returns the current value of the signal without registering a watcher.
     * @returns {T} - The current value of the signal.
     */
    peek(): T;
}
/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 * @extends {Signal<T>}
 */
export class DerivedSignal<T> extends Signal<T> {
    /**
     * @param {() => T} computedFn - A function that generates the value of the computed.
     */
    constructor(computedFn: () => T);
    /**
     * @readonly
     */
    readonly set value(value: T);
    /**
     * @readonly
     */
    readonly get value(): T;
    #private;
}
/**
 * @template T
 * @extends {Signal<T>}
 */
export class SourceSignal<T> extends Signal<T> {
    /**
     * Creates a new Signal with the provided value.
     * @param {T} value
     */
    constructor(value: T);
    /**
     * Sets the value stored in the Signal and triggers an update.
     * @param {T} value
     */
    set value(value: T);
    get value(): T;
    /**
     * @private
     * @param {T} value
     * @returns {T}
     */
    private proxify;
}
export type AsyncRequestAtoms<Input, Output> = {
    /**
     * Represents the loading state of an asynchronous request.
     */
    pending: SourceSignal<boolean>;
    /**
     * Represents the data returned by the asynchronous request.
     */
    data: SourceSignal<Output | null>;
    /**
     * Represents the errors returned by the asynchronous request, if any.
     */
    error: SourceSignal<unknown | null>;
    /**
     * Triggers the asynchronous request.
     */
    run: Input extends undefined ? () => Promise<void> : (input: Input) => Promise<void>;
    /**
     * Triggers the asynchronous request again with an optional new input and optionally changes the loading state.
     */
    reload: (newInput?: Input, changeLoadingState?: boolean) => Promise<void>;
};

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
    static beforeUpdate: (effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined) => number;
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
     * @protected @type T
     */
    protected wvalue: T;
    /**
     * @protected
     * @param {T} value
     */
    protected setValue(value: T): void;
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

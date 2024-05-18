/**
 * @template T
 */
export class Watchable<T> {
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
    protected get rvalue(): T;
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
 * @extends {Watchable<T>}
 */
export class DerivedSignal<T> extends Watchable<T> {
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
 * @extends {Watchable<T>}
 */
export class SourceSignal<T> extends Watchable<T> {
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

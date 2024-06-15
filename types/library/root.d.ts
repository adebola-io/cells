export namespace root {
    let globalPreEffects: [Partial<GlobalEffectOptions>, ((value: unknown) => void)][];
    let globalPostEffects: [Partial<GlobalEffectOptions>, ((value: unknown) => void)][];
    let watchers: WeakMap<import("./classes.js").Watchable<unknown>, ((newValue: unknown) => void)[]>;
    let dependencyGraph: WeakMap<import("./classes.js").Watchable<unknown>, import("./classes.js").DerivedSignal<unknown>[]>;
    let batchNestingLevel: number;
    let batchedEffects: Map<Function, any[]>;
}
/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {Derived[]}
 */
export const activeComputedValues: import("./classes.js").DerivedSignal<unknown>[];
export type Watchable = import('./classes.js').Watchable<unknown>;
export type Derived = import('./classes.js').DerivedSignal<unknown>;
export type GlobalEffectOptions = {
    /**
     * - Whether the effect should be removed after the first run.
     */
    runOnce: boolean;
    /**
     * - Whether the effect should be run even if the signal is a derived signal.
     */
    ignoreDerivedSignals: boolean;
};

/**
 * @typedef {import('./classes.js').Watchable<unknown>} Watchable
 * @typedef {import('./classes.js').DerivedSignal<unknown>} Derived
 *
 * @typedef GlobalEffectOptions
 * @property {boolean} runOnce - Whether the effect should be removed after the first run.
 * @property {boolean} ignoreDerivedSignals - Whether the effect should be run even if the signal is a derived signal.
 */

export const root = {
  /**
   * An array of global effects that run before a source Signal is updated.
   * @type {[Partial<GlobalEffectOptions>, ((value: unknown) => void)][]}
   */
  globalPreEffects: [],

  /**
   * An array of global effects that run after a source Signal is updated.
   * @type {[Partial<GlobalEffectOptions>, ((value: unknown) => void)][]}
   */
  globalPostEffects: [],

  /**
   * A WeakMap that stores watchers for every Signal.
   * @type {WeakMap<Watchable, ((newValue: unknown) => void)[]>}
   */
  watchers: new WeakMap(),

  /**
   * A WeakMap that stores computed dependents for every Signal.
   * @type {WeakMap<Watchable, Derived[]>}
   */
  dependencyGraph: new WeakMap(),
};

/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {Derived[]}
 */
export const activeComputedValues = [];

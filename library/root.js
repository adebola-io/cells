/**
 * @typedef {import('./Watchable').Watchable<any>} Watchable
 * @typedef {import('./Derived').DerivedCell<any>} Derived
 */

export const root = {
  /**
   * An array of global effects that run every time a source Cell is updated.
   * @type {((value: any) => void)[]}
   */
  globalEffects: [],
  /**
   * A WeakMap that stores watchers for every Cell.
   * @type {WeakMap<Watchable, ((newValue: any) => void)[]>}
   */
  watchers: new WeakMap(),

  /**
   * A WeakMap that stores computed dependents for every Cell.
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

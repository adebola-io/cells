/**
 * @typedef {import('./Cell').Cell<any>} Cell
 * @typedef {import('./Derived').Derived<any>} Derived
 */

export const root = {
  /**
   * A WeakMap that stores watchers for every Cell.
   * @type {WeakMap<Cell, ((newValue: any) => void)[]>}
   */
  watchers: new WeakMap(),

  /**
   * A WeakMap that stores computed dependents for every Cell.
   * @type {WeakMap<Cell, Derived[]>}
   */
  dependencyGraph: new WeakMap(),
};

/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {Derived[]}
 */
export const activeComputedValues = [];

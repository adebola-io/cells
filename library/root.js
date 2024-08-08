/**
 * @typedef {import('./classes.js').Cell<any>} Watchable
 * @typedef {import('./classes.js').DerivedCell<any>} DerivedCell
 *
 * @typedef GlobalEffectOptions
 * @property {boolean} runOnce - Whether the effect should be removed after the first run.
 * @property {boolean} ignoreDerivedCells - Whether the effect should be run even if the cell is a derived cell.
 */

export const root = {
  /**
   * An array of global effects that run before a source Cell is updated.
   * @type {[Partial<GlobalEffectOptions>, ((value: unknown) => void)][]}
   */
  globalPreEffects: [],

  /**
   * An array of global effects that run after a source Cell is updated.
   * @type {[Partial<GlobalEffectOptions>, ((value: unknown) => void)][]}
   */
  globalPostEffects: [],

  /**
   * The nesting level of batch operations.
   * This will prevent nested batch operations from triggering effects when they finish.
   * @type {number}
   */
  batchNestingLevel: 0,

  /**
   * A map of effect tuples to be executed in a batch.
   * The key in each entry is the effect, and the value is the list of arguments call it with.
   * All callbacks in this map  will be executed only once in a batch.
   * @type {Map<Function, any[]>}
   */
  batchedEffects: new Map(),
};

/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {DerivedCell[]}
 */
export const activeComputedValues = [];

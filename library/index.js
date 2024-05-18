import { SourceCell } from './Source';
import { DerivedCell } from './Derived';
import { root } from './root';

/**
 * Exports the {@link SourceCell} and {@link DerivedCell} classes, which are part of the Cell API.
 *
 * The `Cell` class represents a mutable signal value, while the `Derived` class
 * represents a derived signal value that is computed from one or more other
 * signal values.
 */
export const Cell = {
  /**
   * Adds an effect that runs every time a Cell is updated.
   * @param {(value: any) => void} effect - The effect function.
   * @example
   * ```
   * import { Cell } from '@adbl/bullet';
   *
   * const cell = Cell.source(0);
   * Cell.createGlobalEffect((value) => console.log(value));
   *
   * cell.value = 1; // prints 1
   * cell.value = 2; // prints 2
   * ```
   */
  createGlobalEffect: (effect) => root.globalEffects.push(effect),

  /**
   * Removes a global effect.
   * @param {(value: any) => void} effect - The effect function added previously.
   */
  removeGlobalEffect: (effect) =>
    root.globalEffects.splice(root.globalEffects.indexOf(effect), 1),

  /**
   * @template T
   * Creates a new Cell instance with the provided value.
   * @param {T} value - The value to be stored in the Cell.
   * @returns {SourceCell<T>} A new Cell instance.
   */
  source: (value) => new SourceCell(value),

  /**
   * @template T
   * Creates a new Derived instance with the provided callback function.
   * @param {() => T} callback - The callback function to be used by the Derived instance.
   * @returns {DerivedCell<T>} A new Derived instance.
   */
  derived: (callback) => new DerivedCell(callback),
};

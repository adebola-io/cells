import { Cell } from './Cell';
import { Derived } from './Derived';

/**
 * Exports the `Cell` and `Derived` classes, which are part of the Signal API.
 *
 * The `Cell` class represents a mutable signal value, while the `Derived` class
 * represents a derived signal value that is computed from one or more other
 * signal values.
 */
export const Signal = {
  /**
   * @template T
   * Creates a new Cell instance with the provided value.
   * @param {T} value - The value to be stored in the Cell.
   * @returns {Cell<T>} A new Cell instance.
   */
  cell: (value) => new Cell(value),

  /**
   * @template T
   * Creates a new Derived instance with the provided callback function.
   * @param {() => T} callback - The callback function to be used by the Derived instance.
   * @returns {Derived<T>} A new Derived instance.
   */
  derived: (callback) => new Derived(callback),
};

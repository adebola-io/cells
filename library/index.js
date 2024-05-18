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
  Cell,
  Derived,
};

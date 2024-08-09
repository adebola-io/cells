export default Cell;
/**
 * Represents a partial map of cells, where each key in the object type `T` is mapped to either a `Cell<T[key]>` or the raw type `T[key]`.
 * This type can be used to represent a partial set of cells for an object, where some properties are represented as cells and others are the raw values.
 */
export type PartialCellMap<T extends object> = { [key in keyof T]: T[key] | Cell<T[key]>; };
/**
 * Represents a full set of cells for an object,
 * where all properties are represented as cells.
 */
export type CellMap<T extends object> = { [key in keyof T]: Cell<T[key]>; };
import { SourceCell } from './classes.js';
import { DerivedCell } from './classes.js';
import { Cell } from './classes.js';
export { SourceCell, DerivedCell, Cell };

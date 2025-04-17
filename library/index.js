import { DerivedCell, SourceCell, Cell, CellUpdateError } from './classes.js';

/**
 * Represents a partial map of cells, where each key in the object type `T` is mapped to either a `Cell<T[key]>` or the raw type `T[key]`.
 * This type can be used to represent a partial set of cells for an object, where some properties are represented as cells and others are the raw values.
 * @template {object} T The object type whose properties are mapped to cells or raw values.
 * @typedef {{ [key in keyof T]: Cell<T[key]> | T[key] }} PartialCellMap
 */

/**
 * Represents a full set of cells for an object,
 * where all properties are represented as cells.
 * @template {object} T The object type whose properties are mapped to cells.
 * @typedef {{ [key in keyof T]: Cell<T[key]> }} CellMap
 */

export { SourceCell, DerivedCell, Cell, CellUpdateError };
export default Cell;

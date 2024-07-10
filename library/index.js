import { DerivedSignal, SourceSignal, Signal } from './classes.js';

/**
 * Represents a partial map of signals, where each key in the object type `T` is mapped to either a `Signal<T[key]>` or the raw type `T[key]`.
 * This type can be used to represent a partial set of signals for an object, where some properties are represented as signals and others are the raw values.
 * @template {object} T The object type whose properties are mapped to signals or raw values.
 * @typedef {{ [key in keyof T]: Signal<T[key]> | T[key] }} PartialSignalMap
 */

/**
 * Represents a full set of signals for an object,
 * where all properties are represented as signals.
 * @template {object} T The object type whose properties are mapped to signals.
 * @typedef {{ [key in keyof T]: Signal<T[key]> }} SignalMap
 */

export { SourceSignal, DerivedSignal, Signal };
export default Signal;

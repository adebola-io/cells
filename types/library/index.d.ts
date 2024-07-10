export default Signal;
/**
 * Represents a partial map of signals, where each key in the object type `T` is mapped to either a `Signal<T[key]>` or the raw type `T[key]`.
 * This type can be used to represent a partial set of signals for an object, where some properties are represented as signals and others are the raw values.
 */
export type PartialSignalMap<T extends object> = { [key in keyof T]: T[key] | Signal<T[key]>; };
/**
 * Represents a full set of signals for an object,
 * where all properties are represented as signals.
 */
export type SignalMap<T extends object> = { [key in keyof T]: Signal<T[key]>; };
import { SourceSignal } from './classes.js';
import { DerivedSignal } from './classes.js';
import { Signal } from './classes.js';
export { SourceSignal, DerivedSignal, Signal };

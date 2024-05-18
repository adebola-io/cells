import { DerivedSignal, SourceSignal } from './classes.js';
import { root } from './root.js';

/**
 * Exports the {@link SourceSignal} and {@link DerivedSignal} classes, which are part of the Signal API.
 *
 * The `Signal` class represents a mutable signal value, while the `Derived` class
 * represents a derived signal value that is computed from one or more other
 * signal values.
 */
const Signal = {
  /**
   * Adds a global effect that runs before any Signal is updated.
   * @param {(value: unknown) => void} effect - The effect function.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - The options for the effect.
   * @example
   * ```
   * import { Signal } from '@adbl/bullet';
   *
   * const signal = Signal.source(0);
   * Signal.beforeUpdate((value) => console.log(value));
   *
   * signal.value = 1; // prints 1
   * signal.value = 2; // prints 2
   * ```
   */
  beforeUpdate: (effect, options) =>
    root.globalPreEffects.push([options ?? {}, effect]),

  /**
   * Adds a global post-update effect to the Signal system.
   * @param {(value: unknown) => void} effect - The effect function to add.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - Options for the effect.
   * @example
   * ```
   * import { Signal } from '@adbl/bullet';
   *
   * const effect = (value) => console.log(value);
   * Signal.afterUpdate(effect);
   *
   * const signal = Signal.source(0);
   * signal.value = 1; // prints 1
   * ```
   */
  afterUpdate: (effect, options) => {
    root.globalPostEffects.push([options ?? {}, effect]);
  },

  removeGlobalEffects: () => {
    root.globalPreEffects = [];
    root.globalPostEffects = [];
  },

  /**
   * Removes a global effect.
   * @param {(value: unknown) => void} effect - The effect function added previously.
   * @example
   * ```
   * import { Signal } from '@adbl/bullet';
   *
   * const effect = (value) => console.log(value);
   * Signal.beforeUpdate(effect);
   *
   * const signal = Signal.source(0);
   * signal.value = 1; // prints 1
   *
   * Signal.removeGlobalEffect(effect);
   *
   * signal.value = 2; // prints nothing
   * ```
   */
  removeGlobalEffect: (effect) => {
    root.globalPreEffects = root.globalPreEffects.filter(
      ([_, e]) => e !== effect
    );
  },

  /**
   * @template T
   * Creates a new Signal instance with the provided value.
   * @param {T} value - The value to be stored in the Signal.
   * @returns {SourceSignal<T>} A new Signal instance.
   * ```
   * import { Signal } from '@adbl/bullet';
   *
   * const signal = Signal.source('Hello world');
   * console.log(signal.value); // Hello world.
   *
   * signal.value = 'Greetings!';
   * console.log(signal.value) // Greetings!
   * ```
   */
  source: (value) => new SourceSignal(value),

  /**
   * @template T
   * Creates a new Derived instance with the provided callback function.
   * @param {() => T} callback - The callback function to be used by the Derived instance.
   * @returns {DerivedSignal<T>} A new Derived instance.
   * ```
   * import { Signal } from '@adbl/bullet';
   *
   * const signal = Signal.source(2);
   * const derived = Signal.derived(() => signal.value * 2);
   *
   * console.log(derived.value); // 4
   *
   * signal.value = 3;
   * console.log(derived.value); // 6
   * ```
   */
  derived: (callback) => new DerivedSignal(callback),
};

export { SourceSignal, DerivedSignal, Signal };
export default Signal;

import { Watchable } from './Watchable.js';
import { activeComputedValues } from './root.js';

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 * @extends {Watchable<T>}
 */
export class Derived extends Watchable {
  #computedFn;

  /**
   * @param {() => T} computedFn - A function that generates the value of the computed.
   */
  constructor(computedFn) {
    super();
    this.#computedFn = computedFn;
    activeComputedValues.push(this);
    this.setValue(computedFn());
    activeComputedValues.pop();
  }

  get value() {
    return this.rvalue;
  }

  set value(value) {
    throw new Error('Cannot set a computed Cell value.');
  }

  /**
   * Updates the current value with the result of the computed function.
   */
  update() {
    this.setValue(this.#computedFn());
    super.update();
  }
}

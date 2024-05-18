import { activeComputedValues } from './root';

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 */
export class Derived {
  id = 'newComputed';
  #computedFn;
  #currentValue;

  /**
   * @param {() => T} computedFn - A function that generates the value of the computed.
   */
  constructor(computedFn) {
    this.#computedFn = computedFn;
    activeComputedValues.push(this);
    this.#currentValue = computedFn();
    activeComputedValues.pop();
  }

  get value() {
    return this.#currentValue;
  }

  set value(value) {
    throw new Error('Cannot set a computed Cell value.');
  }

  /**
   * Updates the current value with the result of the computed function.
   */
  update() {
    const newValue = this.#computedFn();
    this.#currentValue = newValue;
  }
}

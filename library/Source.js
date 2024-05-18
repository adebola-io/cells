import { Watchable } from './Watchable.js';

/**
 * @template T
 * @extends {Watchable<T>}
 */
export class SourceCell extends Watchable {
  /**
   * Creates a new Cell with the provided value.
   * @param {T} value
   */
  constructor(value) {
    super();
    let valueToWatch = value;
    valueToWatch = this.proxify(value);
    this.setValue(valueToWatch);
  }

  get value() {
    return this.rvalue;
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   * @param {T} value
   */
  set value(value) {
    const oldValue = this.wvalue;
    this.setValue(value);

    if (oldValue === this.wvalue) {
      return;
    }

    this.update();
  }

  /**
   * @param {T} value
   * @returns {T}
   */
  proxify(value) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    return new Proxy(value, {
      get: (target, prop) => {
        this.rvalue;
        // @ts-ignore
        return this.proxify(target[prop]);
      },
      set: (target, prop, value) => {
        // @ts-ignore
        target[prop] = value;
        this.update();
        return true;
      },
    });
  }
}

import { Watchable } from './Watchable.js';

/**
 * @template T
 * @extends {Watchable<T>}
 */
export class Cell extends Watchable {
  /**
   * Creates a new Cell with the provided value.
   * @param {T} value
   */
  constructor(value) {
    super();
    this.setValue(value);
  }

  get value() {
    return this._read_value;
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   * @param {T} value
   */
  set value(value) {
    const oldValue = this._write_value;
    this.setValue(value);

    if (oldValue === this._write_value) {
      return;
    }

    this.update();
  }
}

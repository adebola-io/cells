import { activeComputedValues, root } from './root';

/**
 * @template T
 */
export class Cell {
  #value;
  /**
   * Creates a reactive Cell of type T
   * @param {T} value
   */
  constructor(value) {
    this.#value = value;
  }

  /**
   * The value stored in the Cell.
   * @type {T}
   */
  get value() {
    const { dependencyGraph } = root;
    if (!dependencyGraph.has(this)) {
      dependencyGraph.set(this, []);
    }
    const currentlyComputedValue = activeComputedValues.at(-1);

    if (currentlyComputedValue !== undefined) {
      dependencyGraph.get(this)?.push(currentlyComputedValue);
    }

    return this.#value;
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   */
  set value(value) {
    const oldValue = this.#value;
    this.#value = value;

    if (oldValue === this.#value) {
      return;
    }

    this.#update();
  }

  /**
   * Runs all dependents of this Cell.
   */
  #update() {
    // Run watchers.
    const watchers = root.watchers.get(this);
    if (watchers !== undefined) {
      for (const watcher of watchers) {
        watcher(this.#value);
      }
    }

    // Run computed dependents.
    const computedDependents = root.dependencyGraph.get(this);
    if (computedDependents !== undefined) {
      for (const dependent of computedDependents) {
        dependent.update();
      }
    }
  }

  /**
   * @param {(newValue: T) => void | ((oldValue: T, newValue: T) => void)} effect
   */
  onChange(effect) {
    const watchList = root.watchers.get(this);
    if (watchList === undefined) {
      root.watchers.set(this, [effect]);
      return;
    }
    watchList.push(effect);
  }
}

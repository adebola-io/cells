import { activeComputedValues, root } from './root.js';

/**
 * @template T
 */
export class Watchable {
  /**
   * @protected @type T
   */
  wvalue = /** @type {T} */ (null);

  /**
   * @protected
   * @param {T} value
   */
  setValue(value) {
    this.wvalue = value;
  }

  /**
   * The value stored in the Cell.
   * @protected @type {T}
   */
  get rvalue() {
    const { dependencyGraph } = root;
    if (!dependencyGraph.has(this)) {
      dependencyGraph.set(this, []);
    }
    const currentlyComputedValue = activeComputedValues.at(-1);

    if (currentlyComputedValue !== undefined) {
      dependencyGraph.get(this)?.push(currentlyComputedValue);
    }

    return this.wvalue;
  }

  /**
   * Subscribes the provided effect function to the root's watcher list.
   * If the current instance does not have a watcher list, a new one is created.
   * Returns a function that can be used to unsubscribe the effect.
   *
   * @param {(newValue: T) => void} effect - The effect function to subscribe.
   * @returns {() => void} - A function that can be used to unsubscribe the effect.
   */
  createEffect(effect) {
    const watchList = root.watchers.get(this);
    if (watchList === undefined) {
      root.watchers.set(this, [effect]);
      return () => this.removeEffect(effect);
    }
    watchList.push(effect);

    return () => this.removeEffect(effect);
  }

  /**
   * Unsubscribes the provided effect from the root watcher list.
   *
   * @param {(newValue: T) => void} effect - The effect function to unsubscribe.
   */
  removeEffect(effect) {
    const watchList = root.watchers.get(this);
    if (watchList === undefined) {
      return;
    }
    const index = watchList.indexOf(effect);
    if (index === -1) {
      return;
    }
    watchList.splice(index, 1);
  }

  /**
   * Updates the root object and notifies any registered watchers and computed dependents.
   * This method is called whenever the root object's value changes.
   */
  update() {
    // global effects
    for (const effect of root.globalEffects) {
      effect(this.wvalue);
    }

    // Run watchers.
    const watchers = root.watchers.get(this);
    if (watchers !== undefined) {
      for (const watcher of watchers) {
        watcher(this.wvalue);
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
}

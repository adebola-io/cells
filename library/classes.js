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
   * The value stored in the Signal.
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

    // global effects
    for (const [options, effect] of root.globalPostEffects) {
      if (options.ignoreDerivedSignals && this instanceof DerivedSignal) {
        continue;
      }

      effect(this.wvalue);

      if (options.runOnce) {
        root.globalPostEffects = root.globalPostEffects.filter(
          ([_, e]) => e !== effect
        );
      }
    }
  }

  /**
   * Returns the current value of the signal without registering a watcher.
   * @returns {T} - The current value of the signal.
   */
  peek() {
    return this.wvalue;
  }
}

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 * @extends {Watchable<T>}
 */
export class DerivedSignal extends Watchable {
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
    throw new Error('Cannot set a computed Signal value.');
  }

  /**
   * Updates the current value with the result of the computed function.
   */
  update() {
    // global effects
    for (const [options, effect] of root.globalPreEffects) {
      if (options.ignoreDerivedSignals) continue;

      effect(this.wvalue);
    }

    this.setValue(this.#computedFn());
    super.update();
  }
}

/**
 * @template T
 * @extends {Watchable<T>}
 */
export class SourceSignal extends Watchable {
  /**
   * Creates a new Signal with the provided value.
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
   * Sets the value stored in the Signal and triggers an update.
   * @param {T} value
   */
  set value(value) {
    const oldValue = this.wvalue;

    // global effects
    if (value !== this.wvalue)
      for (const [options, effect] of root.globalPreEffects) {
        effect(this.wvalue);

        if (options.runOnce) {
          root.globalPreEffects = root.globalPreEffects.filter(
            ([_, e]) => e !== effect
          );
        }
      }

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

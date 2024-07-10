import { activeComputedValues, root } from './root.js';

/**
 * @template T
 */
export class Signal {
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
  get revalued() {
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
      // @ts-ignore: effects can be functions of any type.
      root.watchers.set(this, [effect]);
      return () => this.removeEffect(effect);
    }
    // @ts-ignore
    watchList.push(effect);

    return () => this.removeEffect(effect);
  }

  /**
   * Subscribes the provided effect function to the root's watcher list and immediately runs the effect with the current value.
   * If the current instance does not have a watcher list, a new one is created.
   * Returns a function that can be used to unsubscribe the effect.
   *
   * @param {(newValue: T) => void} effect - The effect function to subscribe and immediately run.
   * @returns {() => void} - A function that can be used to unsubscribe the effect.
   */
  createImmediateEffect(effect) {
    effect(this.wvalue);
    return this.createEffect(effect);
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
    // @ts-ignore
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
        if (root.batchNestingLevel > 0) {
          root.batchedEffects.set(watcher, [this.wvalue]);
          continue;
        }

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

  /**
   * Adds a global effect that runs before any Signal is updated.
   * @param {(value: unknown) => void} effect - The effect function.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - The options for the effect.
   * @example
   * ```
   * import { Signal } from '@adbl/signals';
   *
   * const signal = Signal.source(0);
   * Signal.beforeUpdate((value) => console.log(value));
   *
   * signal.value = 1; // prints 1
   * signal.value = 2; // prints 2
   * ```
   */
  static beforeUpdate = (effect, options) =>
    root.globalPreEffects.push([options ?? {}, effect]);

  /**
   * Adds a global post-update effect to the Signal system.
   * @param {(value: unknown) => void} effect - The effect function to add.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - Options for the effect.
   * @example
   * ```
   * import { Signal } from '@adbl/signals';
   *
   * const effect = (value) => console.log(value);
   * Signal.afterUpdate(effect);
   *
   * const signal = Signal.source(0);
   * signal.value = 1; // prints 1
   * ```
   */
  static afterUpdate = (effect, options) => {
    root.globalPostEffects.push([options ?? {}, effect]);
  };

  static removeGlobalEffects = () => {
    root.globalPreEffects = [];
    root.globalPostEffects = [];
  };

  /**
   * Removes a global effect.
   * @param {(value: unknown) => void} effect - The effect function added previously.
   * @example
   * ```
   * import { Signal } from '@adbl/signals';
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
  static removeGlobalEffect = (effect) => {
    root.globalPreEffects = root.globalPreEffects.filter(
      ([_, e]) => e !== effect
    );
  };

  /**
   * @template T
   * Creates a new Signal instance with the provided value.
   * @param {T} value - The value to be stored in the Signal.
   * @returns {SourceSignal<T>} A new Signal instance.
   * ```
   * import { Signal } from '@adbl/signals';
   *
   * const signal = Signal.source('Hello world');
   * console.log(signal.value); // Hello world.
   *
   * signal.value = 'Greetings!';
   * console.log(signal.value) // Greetings!
   * ```
   */
  static source = (value) => new SourceSignal(value);

  /**
   * @template T
   * Creates a new Derived instance with the provided callback function.
   * @param {() => T} callback - The callback function to be used by the Derived instance.
   * @returns {DerivedSignal<T>} A new Derived instance.
   * ```
   * import { Signal } from '@adbl/signals';
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
  static derived = (callback) => new DerivedSignal(callback);

  /**
   * Batches all the effects created to run only once.
   * @param {() => void} callback - The function to be executed in a batched manner.
   */
  static batch = (callback) => {
    root.batchNestingLevel++;
    callback();
    root.batchNestingLevel--;
    if (root.batchNestingLevel === 0) {
      for (const [effect, args] of root.batchedEffects) {
        effect(...args);
      }
      root.batchedEffects = new Map();
    }
  };
}

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 * @extends {Signal<T>}
 */
export class DerivedSignal extends Signal {
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

  /**
   * @readonly
   */
  get value() {
    return this.revalued;
  }

  /**
   * @readonly
   */
  set value(value) {
    throw new Error('Cannot set a derived Signal value.');
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

    if (root.batchNestingLevel > 0) {
      root.batchedEffects.set(() => this.setValue(this.#computedFn()), []);
    } else {
      this.setValue(this.#computedFn());
    }

    super.update();
  }
}

/**
 * @template T
 * @extends {Signal<T>}
 */
export class SourceSignal extends Signal {
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
    return this.revalued;
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
   * @private
   * @param {T} value
   * @returns {T}
   */
  proxify(value) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    return new Proxy(value, {
      get: (target, prop) => {
        this.revalued;
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

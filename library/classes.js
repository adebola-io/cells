/**
 * @template Input, Output
 * @typedef {Object} AsyncRequestAtoms
 *
 * @property {SourceCell<boolean>} pending
 * Represents the loading state of an asynchronous request.
 *
 * @property {SourceCell<Output|null>} data
 * Represents the data returned by the asynchronous request.
 *
 * @property {SourceCell<Error | null>} error
 * Represents the errors returned by the asynchronous request, if any.
 *
 * @property {NeverIfAny<Input> extends never ? (input?: Input) => Promise<void> : (input: Input) => Promise<void>} run
 * Triggers the asynchronous request.
 *
 * @property {(newInput?: Input, changeLoadingState?: boolean) => Promise<void>} reload Triggers the asynchronous request again with an optional new input and optionally changes the loading state.
 */

/**
 * @typedef {object} EffectOptions
 * @property {boolean} [once]
 * Whether the effect should be removed after the first run.
 * @property {AbortSignal} [signal]
 * An AbortSignal to be used to ignore the effect if it is aborted.
 * @property {string} [name]
 * The name of the effect for debugging purposes.
 * @property {boolean} [weak]
 * Whether the effect should be weakly referenced. This means that the effect will be garbage collected if there are no other references to it.
 * @property {number} [priority]
 * The priority of the effect. Higher priority effects are executed first. The default priority is 0.
 */

/**
 * @template T
 * @typedef {object} CellOptions
 * @property {boolean} [immutable]
 * Whether the cell should be immutable. If set to true, the cell will not allow updates and will throw an error if the value is changed.
 * @property {boolean} [shallowProxied]
 * Whether the cell's value should be shallowly proxied. If set to true, the cell will only proxy the top-level properties of the value, preventing any changes to nested properties. This can be useful for performance optimizations.
 * @property {(oldValue: T, newValue: T) => boolean} [equals]
 * A function that determines whether two values are equal. If not provided, the default equality function will be used.
 */

/**
 * @template T
 * @typedef {0 extends (1 & T) ? never : T} NeverIfAny
 */

import { activeComputedValues, root } from './root.js';

/**
 * @template T
 * @typedef {{
 *    deref: () => T | undefined
 * }} Reference
 */

/** @template T */
class Effect {
  /**
   * @type {EffectOptions | undefined}
   */
  options;

  /**
   * @type {WeakRef<(newValue: T) => void> | ((newValue: T) => void) }
   */
  #callback;

  /**
   * @param {(newValue: T) => void} callback
   * @param {EffectOptions} [options]
   */
  constructor(callback, options) {
    if (options?.weak) {
      this.#callback = new WeakRef(callback);
    } else {
      this.#callback = callback;
    }
    this.options = options;
  }

  /**
   * Returns the callback function, if it still exists.
   * @returns {((newValue: T) => void) | undefined}
   */
  get callback() {
    if (this.#callback instanceof WeakRef) {
      return this.#callback.deref();
    }
    return this.#callback;
  }
}

/**
 * @template T
 */
export class Cell {
  /**
   * @type {Array<Effect<T>>}
   * @protected
   */
  __effects = [];

  /**
   * @type {Array<[WeakRef<DerivedCell<any>>, () => any]>}
   * @protected
   */
  __derivedCells = [];

  /**
   * @readonly
   */
  get effects() {
    return this.__effects;
  }

  /**
   * @readonly
   * @returns {Array<DerivedCell<any>>}
   */
  get derivedCells() {
    // @ts-ignore
    return this.__derivedCells.map((cell) => cell.deref()).filter(Boolean);
  }

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
   * Overrides `Object.prototype.valueOf()` to return the value stored in the Cell.
   * @returns {T} The value of the Cell.
   */
  valueOf() {
    return this.revalued;
  }

  get value() {
    return this.wvalue;
  }

  /**
   * Stringifies the value of the Cell.
   * @returns {string}
   */
  toString() {
    // @ts-ignore
    return this.wvalue.toString();
  }

  /**
   * The value stored in the Cell.
   * @protected @type {T}
   */
  get revalued() {
    const currentlyComputedValue = activeComputedValues.at(-1);

    if (currentlyComputedValue !== undefined) {
      const isAlreadySubscribed = this.__derivedCells.some(
        (ref) => ref[0].deref() === currentlyComputedValue[0]
      );
      if (isAlreadySubscribed) return this.wvalue;

      this.__derivedCells.push([
        new WeakRef(currentlyComputedValue[0]),
        currentlyComputedValue[1],
      ]);
    }

    return this.wvalue;
  }

  /**
   * Sets a callback function that will be called whenever the value of the Cell changes.
   * @param {(newValue: T) => void} callback - The function to be called when the value changes.
   */
  set onchange(callback) {
    this.listen(callback);
  }

  /**
   * Adds the provided effect callback to the list of effects for this cell, and returns a function that can be called to remove the effect.
   * @param {(newValue: T) => void} callback - The effect callback to add.
   * @param {EffectOptions} [options] - The options for the effect.
   * @returns {() => void} A function that can be called to remove the effect.
   */
  listen(callback, options) {
    let effect = callback;

    if (options?.signal?.aborted) {
      return () => {};
    }

    options?.signal?.addEventListener('abort', () => {
      this.ignore(effect);
    });

    if (options?.once) {
      effect = () => {
        callback(this.wvalue);
        this.ignore(effect);
      };
    }

    if (options?.name && this.isListeningTo(options.name)) {
      throw new Error(
        `An effect with the name "${options.name}" is already listening to this cell.`
      );
    }

    const isAlreadySubscribed = this.__effects.some((effect) => {
      return effect.callback === callback;
    });

    if (!isAlreadySubscribed) {
      this.__effects.push(new Effect(callback, options));
    }

    this.__effects.sort((a, b) => {
      const aPriority = a.options?.priority ?? 0;
      const bPriority = b.options?.priority ?? 0;

      if (aPriority === bPriority) return 0;
      return aPriority < bPriority ? 1 : -1;
    });

    return () => this.ignore(effect);
  }

  /**
   * Creates an effect that is immediately executed with the current value of the cell, and then added to the list of effects for the cell.
   * @param {(newValue: T) => void} callback - The effect callback to add.
   * @param {Partial<EffectOptions>} [options] - The options for the effect.
   * @returns {() => void} A function that can be called to remove the effect.
   */
  runAndListen(callback, options) {
    const cb = callback;

    cb(this.wvalue);

    if (options?.signal?.aborted) {
      return () => {};
    }

    options?.signal?.addEventListener('abort', () => {
      this.ignore(cb);
    });

    if (options?.once) return () => this.ignore(cb);

    if (options?.name && this.isListeningTo(options.name)) {
      const message = `An effect with the name "${options.name}" is already listening to this cell.`;
      throw new Error(message);
    }

    const isAlreadySubscribed = this.__effects.some((e) => {
      return e.callback === callback;
    });

    if (!isAlreadySubscribed) {
      this.__effects.push(new Effect(cb, options));
    }

    this.__effects.sort((a, b) => {
      const aPriority = a.options?.priority ?? 0;
      const bPriority = b.options?.priority ?? 0;
      if (aPriority === bPriority) return 0;
      return aPriority < bPriority ? 1 : -1;
    });

    return () => this.ignore(cb);
  }

  /**
   * Removes the specified effect callback from the list of effects for this cell.
   * @param {(newValue: T) => void} callback - The effect callback to remove.
   */
  ignore(callback) {
    const index = this.__effects.findIndex((e) => {
      return e.callback === callback;
    });
    if (index === -1) return;

    this.__effects.splice(index, 1);
  }

  /**
   * Checks if the cell is listening to a watcher with the specified name.
   * @param {string} name - The name of the watcher to check for.
   * @returns {boolean} `true` if the cell is listening to a watcher with the specified name, `false` otherwise.
   */
  isListeningTo(name) {
    return this.__effects.some((effect) => {
      return effect?.options?.name === name && effect.callback;
    });
  }

  /**
   * Removes the watcher with the specified name from the list of effects for this cell.
   * @param {string} name - The name of the watcher to stop listening to.
   */
  stopListeningTo(name) {
    const effectIndex = this.__effects.findIndex((e) => {
      return e.options?.name === name;
    });
    if (effectIndex === -1) return;

    this.__effects.splice(effectIndex, 1);
  }

  /**
   * Updates the root object and notifies any registered watchers and computed dependents.
   * This method is called whenever the root object's value changes.
   */
  update() {
    // Run watchers.
    for (const effect of this.__effects) {
      const watcher = effect.callback;
      if (watcher === undefined) continue;

      if (root.batchNestingLevel > 0) {
        root.batchedEffects.set(watcher, [this.wvalue]);
        continue;
      }

      watcher(this.wvalue);
    }

    // Remove dead effects.
    this.__effects = this.__effects.filter((effect) => effect.callback);

    // Run computed dependents.
    const computedDependents = this.__derivedCells;
    if (computedDependents !== undefined) {
      for (const dependent of computedDependents) {
        // global effects
        for (const [options, effect] of root.globalPreEffects) {
          if (options.ignoreDerivedCells) continue;

          effect(this.wvalue);
        }

        const deref = dependent[0].deref();
        if (deref === undefined) continue;

        const computedCell = deref;
        const computedFn = dependent[1];

        if (root.batchNestingLevel > 0) {
          root.batchedEffects.set(
            () => computedCell.setValue(computedFn()),
            []
          );
        } else {
          computedCell.setValue(computedFn());
        }
        computedCell.update();
      }
    }
    // Periodically drop dead references.
    this.__derivedCells = this.__derivedCells.filter(
      (ref) => ref[0].deref() !== undefined
    );

    // global effects
    for (const [options, effect] of root.globalPostEffects) {
      if (options.ignoreDerivedCells && this instanceof DerivedCell) {
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
   * Returns the current value of the cell without registering a watcher.
   * @returns {T} - The current value of the cell.
   */
  peek() {
    return this.wvalue;
  }

  /**
   * Adds a global effect that runs before any Cell is updated.
   * @param {(value: unknown) => void} effect - The effect function.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - The options for the effect.
   * @example
   * ```
   * import { Cell } from '@adbl/cells';
   *
   * const cell = Cell.source(0);
   * Cell.beforeUpdate((value) => console.log(value));
   *
   * cell.value = 1; // prints 1
   * cell.value = 2; // prints 2
   * ```
   */
  static beforeUpdate = (effect, options) => {
    root.globalPreEffects.push([options ?? {}, effect]);
  };

  /**
   * Adds a global post-update effect to the Cell system.
   * @param {(value: unknown) => void} effect - The effect function to add.
   * @param {Partial<import('./root.js').GlobalEffectOptions>} [options] - Options for the effect.
   * @example
   * ```
   * import { Cell } from '@adbl/cells';
   *
   * const effect = (value) => console.log(value);
   * Cell.afterUpdate(effect);
   *
   * const cell = Cell.source(0);
   * cell.value = 1; // prints 1
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
   * import { Cell } from '@adbl/cells';
   *
   * const effect = (value) => console.log(value);
   * Cell.beforeUpdate(effect);
   *
   * const cell = Cell.source(0);
   * cell.value = 1; // prints 1
   *
   * Cell.removeGlobalEffect(effect);
   *
   * cell.value = 2; // prints nothing
   * ```
   */
  static removeGlobalEffect = (effect) => {
    root.globalPreEffects = root.globalPreEffects.filter(
      ([_, e]) => e !== effect
    );
  };

  /**
   * @template T
   * Creates a new Cell instance with the provided value.
   * @param {T} value - The value to be stored in the Cell.
   * @param {Partial<CellOptions<T>>} [options] - The options for the cell.
   * @returns {SourceCell<T>} A new Cell instance.
   * ```
   * import { Cell } from '@adbl/cells';
   *
   * const cell = Cell.source('Hello world');
   * console.log(cell.value); // Hello world.
   *
   * cell.value = 'Greetings!';
   * console.log(cell.value) // Greetings!
   * ```
   */
  static source = (value, options) => new SourceCell(value, options);

  /**
   * @template T
   * Creates a new Derived instance with the provided callback function.
   * @param {() => T} callback - The callback function to be used by the Derived instance.
   * @returns {DerivedCell<T>} A new Derived instance.
   * ```
   * import { Cell } from '@adbl/cells';
   *
   * const cell = Cell.source(2);
   * const derived = Cell.derived(() => cell.value * 2);
   *
   * console.log(derived.value); // 4
   *
   * cell.value = 3;
   * console.log(derived.value); // 6
   * ```
   */
  static derived = (callback) => new DerivedCell(callback);

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

  /**
   * Checks if the provided value is an instance of the Cell class.
   * @template [T=any]
   * @template [U=any]
   * @param {Cell<T> | U} value - The value to check.
   * @returns {value is Cell<T>} True if the value is an instance of Cell, false otherwise.
   */
  static isCell = (value) => value instanceof Cell;

  /**
   * @template T
   * Flattens the provided value by returning the value if it is not a Cell instance, or the value of the Cell instance if it is.
   * @param {T | Cell<T>} value - The value to be flattened.
   * @returns {T} The flattened value.
   */
  static flatten = (value) => {
    // @ts-ignore:
    return value instanceof Cell
      ? Cell.flatten(value.wvalue)
      : Array.isArray(value)
      ? Cell.flattenArray(value)
      : value instanceof Object
      ? Cell.flattenObject(value)
      : value;
  };

  /**
   * Flattens an array by applying the `flatten` function to each element.
   * @template T
   * @param {Array<T | Cell<T>>} array - The array to be flattened.
   * @returns {Array<T>} A new array with the flattened elements.
   */
  static flattenArray = (array) => array.map(Cell.flatten);

  /**
   * Flattens an object by applying the `flatten` function to each value.
   * @template {object} T
   * @param {T} object - The object to be flattened.
   * @returns {{ [K in keyof T]: T[K] extends Cell<infer U> ? U : T[K] }} A new object with the flattened values.
   */
  static flattenObject = (object) => {
    const result =
      /** @type {{ [K in keyof T]: T[K] extends Cell<infer U> ? U : T[K] }} */ ({});
    for (const [key, value] of Object.entries(object)) {
      Reflect.set(result, key, Cell.flatten(value));
    }
    return result;
  };

  /**
   * Wraps an asynchronous function with managed state.
   *
   * @template X - The type of the input parameter for the getter function.
   * @template Y - The type of the output returned by the getter function.
   * @param {(input: X) => Promise<Y>} getter - A function that performs the asynchronous operation.
   * @returns {AsyncRequestAtoms<X, Y>} An object containing cells for pending, data, and error states,
   *          as well as functions to run and reload the operation.
   *
   * @example
   * const { pending, data, error, run, reload } = Cell.async(async (input) => {
   *   const response = await fetch(`https://example.com/api/data?input=${input}`);
   *   return response.json();
   * });
   *
   * run('input');
   */
  static async(getter) {
    const pending = Cell.source(false);
    const data = Cell.source(/** @type {Y | null} */ (null));
    const error = Cell.source(/** @type {Error | null} */ (null));

    /** @type {X | undefined} */
    let initialInput = undefined;

    async function run(input = initialInput) {
      pending.value = true;
      error.value = null;
      data.value = null;
      try {
        initialInput = input;
        const result = await getter(/** @type {X} */ (input));
        data.value = result;
      } catch (e) {
        if (e instanceof Error) {
          error.value = e;
        } else {
          throw e;
        }
      } finally {
        pending.value = false;
      }
    }

    /**
     * @param {X} [newInput]
     * @param {boolean} [changeLoadingState]
     */
    async function reload(newInput, changeLoadingState = true) {
      if (changeLoadingState) {
        pending.value = true;
      }
      try {
        const result = await getter(
          /** @type {X} */ (newInput ?? initialInput)
        );
        data.value = result;
      } catch (e) {
        if (e instanceof Error) {
          error.value = e;
        } else {
          throw e;
        }
      } finally {
        if (changeLoadingState) {
          pending.value = false;
        }
      }
    }

    return {
      pending,
      data,
      error,
      run,
      reload,
    };
  }
}

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template T
 * @extends {Cell<T>}
 */
export class DerivedCell extends Cell {
  /**
   * @param {() => T} computedFn - A function that generates the value of the computed.
   */
  constructor(computedFn) {
    super();
    activeComputedValues.push([this, computedFn]);
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
  set value(_) {
    throw new Error('Cannot set a derived Cell value.');
  }
}

/**
 * @template T
 * @extends {Cell<T>}
 */
export class SourceCell extends Cell {
  /** @type {Partial<CellOptions<T>>} */
  options;

  /**
   * Creates a new Cell with the provided value.
   * @param {T} value
   * @param {Partial<CellOptions<T>>} [options]
   */
  constructor(value, options) {
    super();

    this.setValue(options?.shallowProxied ? value : this.proxy(value));
    this.options = options ?? {};
  }

  get value() {
    return this.revalued;
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   * @param {T} value
   */
  set value(value) {
    if (this.options.immutable) {
      throw new Error('Cannot set the value of an immutable cell.');
    }

    const oldValue = this.wvalue;

    const isEqual = this.options.equals
      ? this.options.equals(oldValue, value)
      : deepEqual(oldValue, value);

    if (isEqual) return;

    // global effects
    for (const [options, effect] of root.globalPreEffects) {
      effect(this.wvalue);

      if (options.runOnce) {
        root.globalPreEffects = root.globalPreEffects.filter(
          ([_, e]) => e !== effect
        );
      }
    }

    this.setValue(this.options?.shallowProxied ? value : this.proxy(value));
    this.update();
  }

  /**
   * Proxies the provided value deeply, allowing it to be observed and updated.
   * @template T
   * @param {T} value - The value to be proxied.
   * @returns {T} - The proxied value.
   * @private
   */
  proxy(value) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    return new Proxy(value, {
      get: (target, prop) => {
        this.revalued;
        return this.proxy(Reflect.get(target, prop));
      },
      set: (target, prop, value) => {
        const formerValue = Reflect.get(target, prop);
        Reflect.set(target, prop, value);

        const isEqual = deepEqual(formerValue, value);
        if (!isEqual) this.update();

        return true;
      },
    });
  }
}

/**
 * Recursively compares two values for deep equality.
 * @param {any} a - The first value to compare.
 * @param {any} b - The second value to compare.
 * @returns {boolean} - True if the values are deeply equal, false otherwise.
 */
function deepEqual(a, b) {
  if (a === b) return true;

  if (
    typeof a !== typeof b ||
    typeof a !== 'object' ||
    a === null ||
    b === null
  )
    return false;

  if (Array.isArray(a)) {
    const aLength = a.length;
    if (!Array.isArray(b) || aLength !== b.length) return false;

    for (let i = 0; i < aLength; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
  } else {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const keysALength = keysA.length;
    if (keysALength !== keysB.length) return false;

    for (let i = 0; i < keysALength; i++) {
      const key = keysA[i];
      if (a === b) return true;
      if (!(key in b) || !deepEqual(a[key], b[key])) return false;
    }
  }
  return true;
}

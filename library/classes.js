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
 * @property {boolean} [deep]
 * Whether the cell should watch for changes deep into the given value. By default the cell only reacts to changes at the top level.
 * @property {(oldValue: T, newValue: T) => boolean} [equals]
 * A function that determines whether two values are equal. If not provided, the default equality function will be used.
 */

/**
 * @template T
 * @typedef {0 extends (1 & T) ? never : T} NeverIfAny
 */

/**
 * @template T
 * @typedef {() => T} Cellular
 */

/**
 * The nesting level of batch operations.
 * This will prevent nested batch operations from triggering effects when they finish.
 * @type {number}
 */
let BATCH_NESTING_LEVEL = 0;

/**
 * A map of effect tuples to be executed in a batch.
 * The key in each entry is the effect, and the value is the argument to call it with.
 * All callbacks in this map  will be executed only once in a batch.
 * @type {Map<Function, any>}
 */
let BATCHED_EFFECTS = new Map();

/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {DerivedCell<any>[]}
 */
const ACTIVE_DERIVED_CTX = [];

/**
 * Tracks cells that need to be updated during the update cycle.
 * Cells are added to this stack to be processed and updated sequentially.
 * @type {Set<Cell<any>>}
 */
const UPDATE_BUFFER = new Set();

/** @type {WeakMap<Cell<any>, Set<WeakRef<DerivedCell<any>>>>} */
const DERIVED_CELLS = new WeakMap();

let IS_UPDATING = false;

/** @type {Error[]} */
const cellErrors = [];

/**
 * Processes and updates cells in the update queue.
 *
 * Iterates through cells in the update queue, computing their new values,
 * and updating them if their values have changed. Clears the update queue
 * after processing all cells. It ensures that derived cells are updated
 * in a breadth-first order, which is important for preventing multiple
 * updates of the same cell.
 */
function triggerUpdate() {
  IS_UPDATING = true;
  for (const cell of UPDATE_BUFFER) {
    if (cell instanceof DerivedCell) {
      const newValue = cell.computedFn();
      // @ts-expect-error: wvalue is protected.
      if (deepEqual(cell.wvalue, newValue)) continue;
      // @ts-expect-error: wvalue is protected.
      cell.wvalue = newValue;
    }

    // Run computed dependents.
    const computedDependents = DERIVED_CELLS.get(cell);
    if (computedDependents)
      for (const dependent of computedDependents) {
        const deref = dependent.deref();
        if (deref === undefined) {
          computedDependents.delete(dependent);
          continue;
        }

        const computedCell = deref;
        if (BATCH_NESTING_LEVEL > 0) {
          BATCHED_EFFECTS.set(() => {
            if (!computedCell.initialized) return;
            UPDATE_BUFFER.add(computedCell);
          }, undefined);
        } else {
          if (!computedCell.initialized) continue;
          UPDATE_BUFFER.add(computedCell);
        }
      }

    // @ts-expect-error: Cell.update is protected.
    cell.update();
  }
  UPDATE_BUFFER.clear();
  IS_UPDATING = false;
  throwAnyErrors();
}

function throwAnyErrors() {
  if (cellErrors.length > 0) {
    const errors = [...cellErrors];
    cellErrors.length = 0;
    throw new CellUpdateError(errors);
  }
}

const mutativeMapMethods = new Set(['set', 'delete', 'clear']);
const mutativeSetMethods = new Set(['add', 'delete', 'clear']);
const mutativeArrayMethods = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
]);
const mutativeDateMethods = new Set([
  'setDate',
  'setMonth',
  'setFullYear',
  'setHours',
  'setMinutes',
  'setSeconds',
  'setMilliseconds',
]);

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
 * @template {*} T The type of value stored in the cell
 *
 * Base class for reactive cells.
 * This class should not be instantiated directly - use `Cell.source` or
 * `Cell.derived` instead.
 *
 * @example
 * ```typescript
 * // Create a source cell
 * const count = Cell.source(0);
 *
 * // Listen to changes
 * count.listen(value => console.log('Count changed:', value));
 *
 * // Update the value
 * count.set(1); // Logs: Count changed: 1
 * ```
 */
export class Cell {
  /**
   * @type {Array<Effect<T>>}
   */
  #effects = [];

  constructor() {
    if (new.target === Cell) {
      throw new Error(
        'Cell should not be instantiated directly. Use `Cell.source` or `Cell.derived` instead.',
      );
    }
  }

  /**
   * @returns {Array<DerivedCell<any>>}
   */
  get derivedCells() {
    const dependents = DERIVED_CELLS.get(this);
    const cells = [];
    if (dependents) {
      for (const cell of dependents) {
        const cellDeref = cell.deref();
        if (cellDeref) cells.push(cellDeref);
      }
    }
    return cells;
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
    return this.wvalue;
  }

  /**
   * Gets the current value of the cell and registers it as a dependency if called within a derived cell computation.
   * @returns {T} The value of the Cell.
   */
  get() {
    return this.revalued;
  }

  /**
   * Stringifies the value of the Cell.
   * @returns {string}
   */
  toString() {
    return String(this.wvalue);
  }

  /**
   * The value stored in the Cell.
   * @protected @type {T}
   */
  get revalued() {
    const currentlyComputedValue =
      ACTIVE_DERIVED_CTX[ACTIVE_DERIVED_CTX.length - 1];

    if (currentlyComputedValue === undefined) {
      return this.wvalue;
    }

    let dependents = DERIVED_CELLS.get(this);
    if (dependents === undefined) {
      dependents = new Set();
      DERIVED_CELLS.set(this, dependents);
    }

    const isAlreadySubscribed = dependents?.has(currentlyComputedValue.ref);
    if (isAlreadySubscribed) {
      return this.wvalue;
    }
    dependents.add(currentlyComputedValue.ref);
    return this.wvalue;
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
        `An effect with the name "${options.name}" is already listening to this cell.`,
      );
    }

    const isAlreadySubscribed = this.#effects.some((effect) => {
      return effect.callback === callback;
    });

    if (!isAlreadySubscribed) {
      this.#effects.push(new Effect(effect, options));
    }

    this.#effects.sort((a, b) => {
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

    try {
      cb(this.wvalue);
    } catch (e) {
      if (e instanceof Error) {
        cellErrors.push(e);
      }
    }

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

    const isAlreadySubscribed = this.#effects.some((e) => {
      return e.callback === callback;
    });

    if (!isAlreadySubscribed) {
      this.#effects.push(new Effect(cb, options));
    }

    this.#effects.sort((a, b) => {
      const aPriority = a.options?.priority ?? 0;
      const bPriority = b.options?.priority ?? 0;
      if (aPriority === bPriority) return 0;
      return aPriority < bPriority ? 1 : -1;
    });

    throwAnyErrors();

    return () => this.ignore(cb);
  }

  /**
   * Removes the specified effect callback from the list of effects for this cell.
   * @param {(newValue: T) => void} callback - The effect callback to remove.
   */
  ignore(callback) {
    const index = this.#effects.findIndex((e) => {
      return e.callback === callback;
    });
    if (index === -1) return;

    this.#effects.splice(index, 1);
  }

  /**
   * Checks if the cell is listening to a watcher with the specified name.
   * @param {string} name - The name of the watcher to check for.
   * @returns {boolean} `true` if the cell is listening to a watcher with the specified name, `false` otherwise.
   */
  isListeningTo(name) {
    return this.#effects.some((effect) => {
      return effect?.options?.name === name && effect.callback;
    });
  }

  /**
   * Removes the watcher with the specified name from the list of effects for this cell.
   * @param {string} name - The name of the watcher to stop listening to.
   */
  stopListeningTo(name) {
    const effectIndex = this.#effects.findIndex((e) => {
      return e.options?.name === name;
    });
    if (effectIndex === -1) return;

    this.#effects.splice(effectIndex, 1);
  }

  /**
   * @protected
   * Updates the root object and notifies any registered watchers and computed dependents.
   * This method is called whenever the root object's value changes.
   */
  update() {
    // Run watchers.
    const wvalue = this.wvalue;
    const effects = this.#effects;
    let len = effects.length;

    for (let i = 0; i < len; i++) {
      const watcher = effects[i].callback;
      if (watcher === undefined) {
        effects.splice(i, 1);
        i--;
        len--;
        continue;
      }

      if (BATCH_NESTING_LEVEL > 0) {
        BATCHED_EFFECTS.set(watcher, wvalue);
      } else {
        try {
          watcher(wvalue);
        } catch (e) {
          if (e instanceof Error) {
            cellErrors.push(e);
          }
        }
      }
    }
  }

  /**
   * Returns the current value of the cell without registering dependencies.
   * @returns {T} - The current value of the cell.
   */
  peek() {
    return this.wvalue;
  }

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
   * console.log(cell.get()); // Hello world.
   *
   * cell.set('Greetings!');
   * console.log(cell.get()) // Greetings!
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
   * const derived = Cell.derived(() => cell.get() * 2);
   *
   * console.log(derived.get()); // 4
   *
   * cell.set(3);
   * console.log(derived.get()); // 6
   * ```
   */
  static derived = (callback) => new DerivedCell(callback);

  /**
   * @template X
   * Batches all the effects created to run only once.
   * @param {() => X} callback - The function to be executed in a batched manner.
   * @returns {X} The return value of the callback.
   */
  static batch = (callback) => {
    BATCH_NESTING_LEVEL++;
    /** @type {X | undefined} */
    let value;
    let error;
    try {
      value = callback();
    } catch (e) {
      error = e;
    }
    BATCH_NESTING_LEVEL--;
    if (error instanceof Error) {
      cellErrors.push(error);
    }
    if (BATCH_NESTING_LEVEL === 0) {
      for (const [effect, args] of BATCHED_EFFECTS) {
        effect(args);
      }
      if (!IS_UPDATING) triggerUpdate();
      BATCHED_EFFECTS = new Map();
    }
    throwAnyErrors();
    return /** @type {X} */ (value);
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
    if (value instanceof Cell) {
      if (value instanceof DerivedCell) {
        if (value.initialized) {
          return Cell.flatten(value.wvalue);
        }
        value.setValue(value.computedFn());
        return Cell.flatten(value.wvalue);
      }
      return Cell.flatten(value.wvalue);
    }
    if (Array.isArray(value)) {
      // @ts-expect-error:
      return Cell.flattenArray(value);
    }
    if (value instanceof Object) {
      // @ts-expect-error:
      return Cell.flattenObject(value);
    }
    return value;
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
      pending.set(true);
      error.set(null);
      data.set(null);

      await Cell.batch(async () => {
        try {
          initialInput = input;
          const result = await getter(/** @type {X} */ (input));
          data.set(result);
        } catch (e) {
          if (e instanceof Error) {
            error.set(e);
          } else {
            throw e;
          }
        } finally {
          pending.set(false);
        }
      });
    }

    /**
     * @param {X} [newInput]
     * @param {boolean} [changeLoadingState]
     */
    async function reload(newInput, changeLoadingState = true) {
      if (changeLoadingState) {
        pending.set(true);
      }

      try {
        const result = await getter(
          /** @type {X} */ (newInput ?? initialInput),
        );
        data.set(result);
      } catch (e) {
        if (e instanceof Error) {
          error.set(e);
        } else {
          throw e;
        }
      } finally {
        if (changeLoadingState) {
          pending.set(false);
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
 * @template {*} T
 * @extends {Cell<T>}
 */
export class DerivedCell extends Cell {
  /**
   * @param {() => T} computedFn - A function that generates the value of the computed.
   */
  constructor(computedFn) {
    super();
    this.ref = new WeakRef(this);
    // Ensures that the cell is derived every time the computing function is called.
    const derivationWrapper = () => {
      ACTIVE_DERIVED_CTX.push(this);
      let value = this.wvalue;
      try {
        value = computedFn();
      } catch (e) {
        if (e instanceof Error) cellErrors.push(e);
      }
      ACTIVE_DERIVED_CTX.pop();
      return value;
    };
    this.computedFn = /** @type {() => T} */ (derivationWrapper);
    this.initialized = false;
  }

  /** @type {() => T} */
  computedFn;

  /** @type {WeakRef<this>} */
  ref;

  /**
   * Gets the current value of the derived cell, computing it if necessary,
   * and registers it as a dependency if called within another derived cell computation.
   * @returns {T} The value of the Cell.
   */
  get() {
    if (!this.initialized) {
      this.initialized = true;
      this.setValue(this.computedFn());
      throwAnyErrors();
    }
    return this.revalued;
  }

  /**
   * Listens for changes to the cell, initializing the value if not already done.
   * @param {(newValue: T) => void} callback - The function to call when the cell's value changes.
   * @param {object} [options] - Optional configuration for listening.
   */
  listen(callback, options) {
    if (!this.initialized) {
      this.initialized = true;
      this.setValue(this.computedFn());
      throwAnyErrors();
    }
    return super.listen(callback, options);
  }

  /**
   * Runs the callback and sets up a listener, initializing the cell's value if not already done.
   * @param {(newValue: T) => void} callback - The function to call when the cell's value changes.
   * @param {object} [options] - Optional configuration for listening and running.
   * @returns {*} The result of the parent class's runAndListen method.
   */
  runAndListen(callback, options) {
    if (!this.initialized) {
      this.initialized = true;
      this.setValue(this.computedFn());
      throwAnyErrors();
    }
    return super.runAndListen(callback, options);
  }
}

/**
 * @template {*} T
 * @extends {Cell<T>}
 * A cell whose value can be directly modified.
 * Source cells are the primary way to introduce reactivity.
 * They can hold any value type and will automatically handle proxying of objects
 * to enable deep reactivity when needed.
 *
 * @example
 * ```typescript
 * const count = Cell.source(0);
 * ```
 *
 * @example
 * ```typescript
 * // With options
 * const immutableCell = Cell.source(42, { immutable: true });
 * // Will throw error:
 * immutableCell.set(43);
 * ```
 */
export class SourceCell extends Cell {
  /**
   * Creates a new Cell with the provided value.
   * @param {T} value
   * @param {Partial<CellOptions<T>>} [options]
   */
  constructor(value, options) {
    super();

    if (options !== undefined) this.options = options;
    this.setValue(value);
  }

  peek() {
    return this.wvalue;
  }

  /**
   * Gets the current value of the source cell and registers it as a dependency if called within a derived cell computation.
   * @returns {T} The value of the Cell.
   */
  get() {
    return this.#proxy(this.revalued);
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   * @param {T} value
   */
  set(value) {
    if (this.options?.immutable) {
      throw new Error('Cannot set the value of an immutable cell.');
    }

    const oldValue = this.wvalue;
    const isEqual = this.options?.equals
      ? this.options.equals(oldValue, value)
      : deepEqual(oldValue, value);

    if (isEqual) return;

    this.setValue(value);
    UPDATE_BUFFER.add(this);
    if (!IS_UPDATING) triggerUpdate();
  }

  /**
   * Proxies the provided value deeply, allowing it to be observed and updated.
   * @template T
   * @param {T} value - The value to be proxied.
   * @returns {T} - The proxied value.
   */
  #proxy(value) {
    if (typeof value !== 'object' || value === null) return value;
    return new Proxy(value, {
      get: (target, prop) => {
        this.revalued;
        if (this.options?.deep) {
          // @ts-expect-error: Direct access is faster than Reflection here.
          return this.#proxy(target[prop]);
        }

        if (typeof prop === 'string') {
          const isMutativeMethod =
            (target instanceof Map && mutativeMapMethods.has(prop)) ||
            (target instanceof Set && mutativeSetMethods.has(prop)) ||
            (target instanceof Date && mutativeDateMethods.has(prop)) ||
            ((ArrayBuffer.isView(target) || Array.isArray(target)) &&
              mutativeArrayMethods.has(prop));

          if (isMutativeMethod) {
            // @ts-expect-error: Direct access is faster than Reflection here.
            return (...args) => {
              // @ts-expect-error: Direct access is faster than Reflection here.
              const result = target[prop](...args);
              UPDATE_BUFFER.add(this);
              if (!IS_UPDATING) triggerUpdate();
              return result;
            };
          }
        }

        // @ts-expect-error: Direct access is faster than Reflection here.
        let value = target[prop];

        if (typeof value === 'function') {
          value = value.bind(target);
        }

        return value;
      },
      set: (target, prop, value) => {
        // @ts-expect-error: dynamic object access.
        const formerValue = target[prop];
        const isEqual = deepEqual(formerValue, value);
        if (!isEqual) {
          // @ts-expect-error: dynamic object access.
          target[prop] = value;
          UPDATE_BUFFER.add(this);
          if (!IS_UPDATING) {
            triggerUpdate();
          }
        }

        return true;
      },
    });
  }
}

/**
 * An error class that aggregates multiple errors thrown during a cell update cycle.
 *
 * This error is thrown when one or more errors are encountered while updating cells,
 * such as when running effect callbacks or computed updates. The `errors` property
 * contains an array of all the errors that occurred during the update cycle.
 *
 * @example
 * try {
 *   // Some cell update logic that may throw
 * } catch (e) {
 *   if (e instanceof CellUpdateError) {
 *     console.error('Multiple errors occurred:', e.errors);
 *   }
 * }
 */
export class CellUpdateError extends Error {
  /** @param {Error[]} errors */
  constructor(errors) {
    super('Errors occurred during cell update cycle');
    this.errors = errors;
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

  if (a instanceof Date) {
    if (!(b instanceof Date)) {
      return false;
    }

    if (a.getTime() !== b.getTime()) {
      return false;
    }
  }

  if (a instanceof Map) {
    if (!(b instanceof Map)) {
      return false;
    }

    if (a.size !== b.size) {
      return false;
    }
    for (const [key, value] of a.entries()) {
      if (!deepEqual(b.get(key), value)) {
        return false;
      }
    }
  }

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

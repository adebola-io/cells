/**
 * @template T
 * @typedef {(track: <T>(cell: Cell<T>) => T) => T} ComputedFn
 */

/**
 * @template {Record<string, Cell<any>>} CellData
 * @typedef Composite
 * An object of barrier-synchronized async derived cells. Each member waits for
 * *all* inputs to settle before yielding.
 * @property {{
 *  [key in keyof CellData]:
 *    CellData[key] extends AsyncDerivedCell<infer T>
 *    ? AsyncDerivedCell<T> :
 *    CellData[key] extends Cell<infer X> ? AsyncDerivedCell<X> : never }} values
 * @property {Cell<boolean>} pending
 * @property {Cell<Error | null>} error
 * @property {Cell<boolean>} loaded Whether the composite has completed its initial load.
 */

/**
 * @typedef {object} EffectOptions
 * @property {boolean} [once]
 * Whether the effect should be removed after the first run.
 * @property {AbortSignal} [signal]
 * An AbortSignal to be used to ignore the effect if it is aborted.
 * @property {boolean} [weak]
 * Whether the effect should be weakly referenced. This means that the effect will be garbage collected if there are no other references to it.
 * @property {number} [priority]
 * The priority of the effect. Higher priority effects are executed first. The default priority is 0.
 */

/**
 * @template T
 * @typedef {object} CellOptions
 * @property {(oldValue: T, newValue: T) => boolean} [equals]
 * A function that determines whether two values are equal. If not provided, the default equality function will be used.
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
 * A value representing the computed values that are currently being calculated,
 * and the largest depth encountered.
 * It is an array so it can keep track of nested computed values.
 * @type {[DerivedCell<any>, number][]}
 */
const ACTIVE_DERIVED_CTX = [];

/**
 * @template {WeakKey & { ref: WeakRef<any> | null }} Value
 * @extends {Set<Value>}
 */
class InternallyWeakSet {
  /** @type {Set<WeakRef<Value>>} */
  #internal = new Set();

  /** @param {Value} value */
  add(value) {
    if (value.ref === null) value.ref = new WeakRef(value);
    this.#internal.add(value.ref);
    return this;
  }

  /** @param {Value} value */
  delete(value) {
    if (value.ref === null) return false;
    return this.#internal.delete(value.ref);
  }

  /** @param {Value} value */
  has(value) {
    if (value.ref === null) return false;
    return this.#internal.has(value.ref);
  }

  *[Symbol.iterator]() {
    for (const ref of this.#internal) {
      const value = ref.deref();
      if (value) yield value;
      else this.#internal.delete(ref); // Cleanup dead refs while iterating
    }
  }
}

/**
 * @template {WeakKey & { ref: WeakRef<any> | null }}  Value
 * @typedef {InternallyWeakSet<Value> | Set<Value>} SetLike
 */

/**
 * @template {WeakKey & { ref: WeakRef<any> | null }} Key
 * @template Value
 * @typedef {Map<Key, Value> | WeakMap<Key, Value>} MapLike
 */

const GlobalTrackingContext = {};
let CurrentTrackingContext = GlobalTrackingContext;
const Depth = Symbol();
const IsScheduled = Symbol();
const Deferred = Symbol();
const DisposeAsyncCell = Symbol();

/**
 * Tracks cells that need to be updated during the update cycle.
 * Cells are added to this stack to be processed and updated sequentially.
 * @type {Array<Cell<any>>}
 */
let UPDATE_BUFFER = [];
let IS_UPDATING = false;

/** @type {object[]} */
const CONTEXT_STACK = [GlobalTrackingContext];

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
  let currentDepth = 0;
  let lastProcessedCellIndex = 0;
  while (lastProcessedCellIndex < UPDATE_BUFFER.length) {
    for (let i = lastProcessedCellIndex; i < UPDATE_BUFFER.length; i++) {
      const cell = UPDATE_BUFFER[i];
      if (cell instanceof DerivedCell) {
        const depth = cell[Depth];
        if (depth > currentDepth + 1) {
          if (cell[Deferred]) {
            currentDepth++;
          } else {
            cell[Deferred] = true;
          }
          // Move nodes with higher depths to the end of the array so they
          // are processed last.
          UPDATE_BUFFER.push(cell);
          continue;
        }
        cell[Deferred] = false;
        if (depth > currentDepth) currentDepth = depth;
        const newValue = cell.computedFn();
        if (cell instanceof AsyncDerivedCell) {
          // async cells will handle propagation manually.
          cell[IsScheduled] = false;
          const computedDependents = cell.derivations;
          for (const computedCell of computedDependents) {
            if (computedCell instanceof AsyncDerivedCell) continue;
            if (computedCell[IsScheduled]) continue;

            UPDATE_BUFFER.push(computedCell);
            computedCell[IsScheduled] = true;
          }
          continue;
        }
        // @ts-expect-error: wvalue is protected.
        if (deepEqual(cell.wvalue, newValue)) {
          cell[IsScheduled] = false;
          continue;
        }
        // @ts-expect-error: wvalue is protected.
        cell.wvalue = newValue;
      }

      // Run computed dependents.
      const computedDependents = cell.derivations;
      for (const computedCell of computedDependents) {
        if (computedCell[IsScheduled]) continue;

        UPDATE_BUFFER.push(computedCell);
        computedCell[IsScheduled] = true;
      }
    }
    // A cell can update in another's effect, triggering a rerun
    // of the whole process. Since the UPDATE_BUFFER is the same array,
    // we need to know where to continue iteration from.
    let i = lastProcessedCellIndex;
    lastProcessedCellIndex = UPDATE_BUFFER.length;
    for (; i < UPDATE_BUFFER.length; i++) {
      const cell = UPDATE_BUFFER[i];
      if (cell[IsScheduled]) {
        // @ts-expect-error: Cell.update is protected.
        cell.update();
        cell[IsScheduled] = false;
      }
    }
  }

  IS_UPDATING = false;
  UPDATE_BUFFER.length = 0;
  lastProcessedCellIndex = 0;
  throwAnyErrors();
}

function throwAnyErrors() {
  if (cellErrors.length > 0) {
    const errors = [...cellErrors];
    for (const error of errors) console.warn(error);
    cellErrors.length = 0;
    throw new CellUpdateError(errors);
  }
}

/** @template {*} out T */
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

export class LocalContext {
  /** @type {Map<DerivedCell<any>, Set<Cell<any>>>} */
  derivationSourceMap = new Map();
  /** @type {Map<Cell<any>, Set<Effect<any>>>} */
  effects = new Map();

  destroy() {
    if (CONTEXT_STACK.includes(this)) {
      throw new Error('Cannot destroy a context inside its callback.');
    }

    for (const [derivation, sources] of this.derivationSourceMap) {
      for (const source of sources) {
        source.derivations.delete(derivation);
      }
      if (derivation instanceof AsyncCell) derivation[DisposeAsyncCell]();
    }

    for (const [cell, effects] of this.effects) {
      if (cell instanceof DerivedCell && this.derivationSourceMap.has(cell)) {
        // There is no point to ignoring the listener, since it will be disposed
        // and unreachable on the graph anyway.
        continue;
      }

      for (const effect of effects) {
        if (effect.callback !== undefined) cell.ignore(effect.callback);
      }
    }

    this.derivationSourceMap.clear();
    this.effects.clear();
  }
}

/**
 * @template T
 * @param {Cell<T>} cell
 * @param {Effect<T>} effectContainer
 */
function addEffectToCurrentContext(cell, effectContainer) {
  if (!(CurrentTrackingContext instanceof LocalContext)) return;
  let effectStore = CurrentTrackingContext.effects.get(cell);
  if (effectStore === undefined) {
    effectStore = new Set();
    CurrentTrackingContext.effects.set(cell, effectStore);
  }
  effectStore.add(effectContainer);
}

/**
 * @param {LocalContext} context
 */
function pushLocalContext(context) {
  CONTEXT_STACK.push(context);
  CurrentTrackingContext = context;
}

function popLocalContext() {
  CONTEXT_STACK.pop();
  CurrentTrackingContext = CONTEXT_STACK[CONTEXT_STACK.length - 1];
}

/**
 * @template {*} out T The type of value stored in the cell
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
   * @protected
   */
  [IsScheduled] = false;

  /**
   * @type {Array<Effect<T>>}
   */
  #effects = [];

  /** @type {WeakRef<this> | null} */
  ref = null;

  constructor() {
    if (new.target === Cell) {
      throw new Error(
        'Cell should not be instantiated directly. Use `Cell.source` or `Cell.derived` instead.',
      );
    }
    /**
     * @type {SetLike<DerivedCell<any>>}
     */
    this.derivations =
      CurrentTrackingContext === GlobalTrackingContext
        ? new InternallyWeakSet()
        : new Set();
  }

  /**
   * @protected @type T
   */
  wvalue = /** @type {T} */ (null);

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
    const ctx = ACTIVE_DERIVED_CTX[ACTIVE_DERIVED_CTX.length - 1];

    if (ctx === undefined) {
      return this.wvalue;
    }

    const [currentlyComputedValue] = ctx;
    const isAlreadySubscribed = this.derivations.has(currentlyComputedValue);
    if (isAlreadySubscribed) {
      return this.wvalue;
    }
    if (this instanceof DerivedCell && this[Depth] > ctx[1]) {
      ctx[1] = this[Depth];
    }
    this.derivations.add(currentlyComputedValue);
    if (CurrentTrackingContext instanceof LocalContext) {
      CurrentTrackingContext.derivationSourceMap
        .get(currentlyComputedValue)
        ?.add(this);
    }
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

    const isAlreadySubscribed = this.#effects.some((effect) => {
      return effect.callback === callback;
    });

    if (!isAlreadySubscribed) {
      const effectContainer = new Effect(effect, options);
      this.#effects.push(effectContainer);

      addEffectToCurrentContext(this, effectContainer);
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

    const isAlreadySubscribed = this.#effects.some((e) => {
      return e.callback === callback;
    });

    if (!isAlreadySubscribed) {
      const effectContainer = new Effect(cb, options);
      this.#effects.push(effectContainer);
      addEffectToCurrentContext(this, effectContainer);
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
   * @protected
   * Updates the root object and notifies any registered watchers and computed dependents.
   * This method is called whenever the root object's value changes.
   */
  update() {
    // Run watchers.
    const wvalue = this.wvalue;
    // Make a copy to avoid issues if effects are removed during iteration (e.g., once: true)
    const effects = [...this.#effects];

    let hasUndefinedEffect = false;
    for (const { callback: watcher } of effects) {
      if (watcher === undefined) {
        hasUndefinedEffect = true;
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
    if (hasUndefinedEffect) {
      this.#effects = this.#effects.filter(
        (effect) => effect.callback !== undefined,
      );
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
   * @template U
   * Creates a new Cell instance with the provided value.
   * @param {U} value - The value to be stored in the Cell.
   * @param {Partial<CellOptions<U>>} [options] - The options for the cell.
   * @returns {SourceCell<U>} A new Cell instance.
   * @type <U>(value: U, options?: Partial<CellOptions<U>>) => SourceCell<U>
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
   * @template U
   * Creates a new Derived instance with the provided callback function.
   * @param {() => U} callback - The callback function to be used by the Derived instance.
   * @returns {DerivedCell<U>} A new Derived instance.
   * @type <U>(callback: () => U) => DerivedCell<U>
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
   * Creates a new LocalContext container.
   * This context can be used to track effects and derived cells created within a specific scope
   * and dispose of them synchronously using `context.destroy()`.
   *
   * @returns {LocalContext} A new LocalContext instance.
   */
  static context = () => new LocalContext();

  /**
   * Creates a new AsyncDerivedCell that computes its value asynchronously.
   * The cell automatically re-computes when any of its dependencies change,
   * with built-in support for cancellation, loading state, and error handling.
   *
   * @template U
   * @param {(get: <T>(cell: Cell<T>) => T, signal: AbortSignal) => Promise<U>} callback - An async function that computes the derived value.
   *   - `get`: A function to read cell values while tracking them as dependencies.
   *   - `signal`: An AbortSignal that is aborted when a new computation starts,
   *     useful for cancelling in-flight requests.
   * @returns {AsyncDerivedCell<U>} A new AsyncDerivedCell instance.
   *
   * @example
   * ```javascript
   * import { Cell } from '@adbl/cells';
   *
   * const userId = Cell.source(1);
   *
   * const userData = Cell.derivedAsync(async (get, signal) => {
   *   const id = get(userId); // Tracks userId as a dependency
   *   const response = await fetch(`/api/users/${id}`, { signal });
   *   return response.json();
   * });
   *
   * // Access loading and error states
   * userData.pending.listen((loading) => console.log('Loading:', loading));
   * userData.error.listen((err) => err && console.error(err));
   *
   * // Get the async value
   * const data = await userData.get();
   * ```
   */
  static derivedAsync = (callback) => new AsyncDerivedCell(callback);

  /**
   * Creates a new AsyncTaskCell that represents a one-time asynchronous computation.
   * Unlike derivedAsync which re-computes automatically when dependencies change,
   * a task only executes when explicitly called via `runWith(input)`.
   *
   * Tasks are ideal for:
   * - Form submissions
   * - One-time API calls
   * - User-triggered actions
   * - Operations that should not auto-execute
   *
   * @template Input, Output
   * @param {(input: Input, signal: AbortSignal) => Promise<Output>} fn - An async function that performs the task.
   *   - `input`: The input value passed when calling `runWith(input)`.
   *   - `signal`: An AbortSignal that is aborted when a new execution starts,
   *     useful for cancelling in-flight requests.
   * @returns {AsyncTaskCell<Input, Output>} A new AsyncTaskCell instance.
   *
   * @example
   * ```javascript
   * // Create a task for submitting form data
   * const submitTask = Cell.task(async (formData, signal) => {
   *   const response = await fetch('/api/submit', {
   *     method: 'POST',
   *     body: formData,
   *     signal
   *   });
   *   return response.json();
   * });
   *
   * // Execute the task
   * const result = await submitTask.runWith({ name: 'John' });
   *
   * // Access loading and error states
   * submitTask.pending.listen((isPending) => {
   *   console.log('Submitting:', isPending);
   * });
   *
   * submitTask.error.listen((err) => {
   *   if (err) console.error('Submission failed:', err);
   * });
   * ```
   *
   * @example
   * ```javascript
   * // Tasks can be used with Cell.composite for managing multiple operations
   * const uploadTask = Cell.task(async (file) => {
   *   // Upload logic
   * });
   *
   * const deleteTask = Cell.task(async (id) => {
   *   // Delete logic
   * });
   *
   * const operations = Cell.composite({ upload: uploadTask, delete: deleteTask });
   *
   * // Track overall pending state
   * operations.pending.listen((isPending) => {
   *   console.log('Operations in progress:', isPending);
   * });
   * ```
   */
  static task = (fn) => new AsyncTaskCell(fn);

  /**
   * Joins multiple cells into a single “all-or-nothing” async unit.
   *
   * Each returned property only produces a new value after **every** input cell
   * has settled for the current round, so reads like:
   *
   * ```js
   * const u = await group.values.user.get();
   * const n = await group.values.notifications.get();
   * ```
   *
   * won’t observe partial updates.
   *
   * @template {Record<string, Cell<any>>} CellData
   * @param {CellData} input Cells to join (may include async and sync cells).
   * @returns {Composite<CellData>}
   *
   * @example
   * const user = Cell.derivedAsync(async (get) => fetchUser(get(id)));
   * const notifications = Cell.derivedAsync(async (get) => fetchNotifs(get(id)));
   *
   * const group = Cell.composite({ user, notifications });
   *
   * group.pending.listen(showSpinner);
   * group.error.listen(showError);
   * group.loaded.listen((isLoaded) => isLoaded && hideInitialSkeleton());
   *
   * const u = await group.values.user.get();
   * const n = await group.values.notifications.get();
   */
  static composite = (input) => {
    const output = /** @type {Composite<CellData>['values']} */ ({});
    const error = Cell.derived(() => {
      return (
        Object.values(input)
          .map((cell) => (cell instanceof AsyncCell ? cell.error.get() : null))
          .find(Boolean) || null
      );
    });
    const pending = Cell.derived(() => {
      return Object.values(input)
        .map((cell) => (cell instanceof AsyncCell ? cell.pending.get() : false))
        .some(Boolean);
    });
    const loaded = Cell.source(!pending.peek());
    pending.listen((isPending) => {
      if (!isPending && !loaded.peek()) {
        loaded.set(true);
      }
    });
    const barrier = Cell.derivedAsync((get) => {
      return Promise.all(Object.values(input).map(get));
    });

    const values = Object.keys(input).reduce((output, key) => {
      const value = Cell.derivedAsync(async (get) => {
        await get(barrier);
        const err = error.peek();
        if (err) throw err;
        const nextValue = await get(input[key]);
        await get(barrier);
        return nextValue;
      });
      Reflect.set(output, key, value);
      return output;
    }, output);

    return { values, pending, error, loaded };
  };
  /**
   * Executes a function within a specific LocalContext.
   * Any effects (`.listen`) or derived cells (`Cell.derived`) created synchronously
   * within the callback will be attached to the provided context.
   *
   * @template T
   * @param {LocalContext} context - The context to bind resources to.
   * @param {() => T} callback - The function to execute.
   * @returns {T} The return value of the callback.
   */
  static runWithContext = (context, callback) => {
    pushLocalContext(context);
    try {
      return callback();
    } finally {
      popLocalContext();
    }
  };

  /**
   * @template X
   * Batches all the effects created to run only once.
   * @param {() => X} callback - The function to be executed in a batched manner.
   * @returns {X} The return value of the callback.
   */
  static batch = (callback) => {
    const currentBatchLevel = BATCH_NESTING_LEVEL;
    const currentUpdateBuffer = UPDATE_BUFFER;
    const wasUpdating = IS_UPDATING;
    const currentBatchedEffects = BATCHED_EFFECTS;

    UPDATE_BUFFER = [];
    IS_UPDATING = true;
    BATCH_NESTING_LEVEL++;
    BATCHED_EFFECTS = new Map();
    /** @type {X | undefined} */
    let value;
    try {
      try {
        value = callback();
      } catch (e) {
        if (e instanceof Error) cellErrors.push(e);
      }
      if (!wasUpdating) triggerUpdate();
    } catch (e) {
      if (e instanceof Error) cellErrors.push(e);
    } finally {
      BATCH_NESTING_LEVEL = currentBatchLevel;
      if (BATCH_NESTING_LEVEL === 0) {
        for (const [effect, value] of BATCHED_EFFECTS) {
          try {
            effect(value);
          } catch (e) {
            if (e instanceof Error) cellErrors.push(e);
          }
        }
      } else {
        // Merge nested batch effects into parent batch so they're not lost
        for (const [effect, value] of BATCHED_EFFECTS) {
          currentBatchedEffects.set(effect, value);
        }
      }

      // Merge any cells scheduled for update into the parent buffer
      for (const cell of UPDATE_BUFFER) {
        if (!currentUpdateBuffer.includes(cell)) {
          currentUpdateBuffer.push(cell);
        }
      }

      UPDATE_BUFFER = currentUpdateBuffer;
      IS_UPDATING = wasUpdating;
      BATCH_NESTING_LEVEL = currentBatchLevel;
      BATCHED_EFFECTS = currentBatchedEffects;
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
}

/**
 * A class that represents a computed value that depends on other reactive values.
 * The computed value is automatically updated when any of its dependencies change.
 * @template {*} out T
 * @extends {Cell<T>}
 */
export class DerivedCell extends Cell {
  [Depth] = 0;
  [Deferred] = false;

  /**
   * @param {() => T} computedFn - A function that generates the value of the computed.
   */
  constructor(computedFn) {
    super();
    if (CurrentTrackingContext instanceof LocalContext) {
      CurrentTrackingContext.derivationSourceMap.set(this, new Set());
    }

    // Ensures that the cell is derived every time the computing function is called.
    const derivationWrapper = () => {
      ACTIVE_DERIVED_CTX.push([this, 0]);
      try {
        return computedFn();
      } catch (e) {
        if (e instanceof Error) cellErrors.push(e);
        return this.wvalue;
      } finally {
        const i = /** @type {[this, number]} */ (ACTIVE_DERIVED_CTX.pop());
        const [, depth] = i;
        if (depth + 1 > this[Depth]) this[Depth] = depth + 1;
      }
    };

    /** @protected @type {T} */
    this.wvalue = derivationWrapper();
    this.computedFn = /** @type {() => T} */ (derivationWrapper);
    throwAnyErrors();
  }

  /** @type {() => T} */
  computedFn;

  /**
   * Gets the current value of the derived cell, computing it if necessary,
   * and registers it as a dependency if called within another derived cell computation.
   * @returns {T} The value of the Cell.
   */
  get() {
    return this.revalued;
  }
}

/**
 * @template {*} out T
 * @extends {Cell<T>}
 * A cell whose value can be directly modified.
 * Source cells are the primary way to introduce reactivity.
 *
 * @example
 * ```typescript
 * const count = Cell.source(0);
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

    /** @protected */
    this.wvalue = value;
    this.options = options;
  }

  peek() {
    return this.wvalue;
  }

  /**
   * Gets the current value of the source cell and registers it as a dependency if called within a derived cell computation.
   * @returns {T} The value of the Cell.
   */
  get() {
    return this.revalued;
  }

  /**
   * Sets the value stored in the Cell and triggers an update.
   * @param {T} value
   */
  set(value) {
    const oldValue = this.wvalue;
    const isEqual = this.options?.equals
      ? this.options.equals(oldValue, value)
      : deepEqual(oldValue, value);

    if (isEqual) return;

    this.wvalue = value;
    this[IsScheduled] = true;
    UPDATE_BUFFER.push(this);
    if (!IS_UPDATING) triggerUpdate();
  }
}

/**
 * @template {*} out T - The type of the resolved async value.
 * @extends {DerivedCell<Promise<T>>}
 */
export class AsyncCell extends DerivedCell {
  /** @type {Set<Promise<any>>} */
  #upstream = new Set();
  /** @type {Set<AsyncCell<any>>} */
  #consumed = new Set();
  /** @type {undefined | (() => void)} */
  #abandonLastComputation;
  /** @type {AbortController | undefined} */
  #controller;

  /**
   * @protected
   * Aborts the current computation if one is running.
   * @returns {void}
   */
  abort() {
    this.#controller?.abort();
  }

  /**
   * Gets the AbortSignal for the current computation.
   * @protected
   * @returns {AbortSignal}
   */
  get _signal() {
    if (!this.#controller) {
      this.#controller = new AbortController();
    }
    return this.#controller.signal;
  }

  /**
   * A cell that indicates whether the async computation is currently running.
   * @type {SourceCell<boolean>}
   */
  pending = Cell.source(true);

  /**
   * A cell that holds any error thrown during the async computation.
   * Resets to `null` when a new computation starts.
   * @type {SourceCell<Error | null>}
   */
  error = Cell.source(null);

  /**
   * @param {(get: <T>(cell: Cell<T>) => T, signal: AbortSignal) => Promise<T>} fn
   */
  constructor(fn) {
    const initialState = /** @type {Promise<T>} */ (Promise.resolve(null));
    super(() => initialState);
    let lastStablePromise = initialState;
    /** @type [this, number] */
    let derivedCtx = [this, this[Depth]];
    let runId = 0;

    /**
     * @template T
     * @param {Cell<T>} cell
     * @returns {T}
     */
    const get = (cell) => {
      ACTIVE_DERIVED_CTX.push(derivedCtx);
      const value = cell.get();
      if (cell instanceof AsyncCell && value instanceof Promise) {
        const currentRunId = runId;
        value.then(() => {
          if (runId === currentRunId) this.#consumed.add(cell);
        });
      }
      ACTIVE_DERIVED_CTX.pop();
      return value;
    };

    this.computedFn = async () => {
      const currentRunId = ++runId;
      this.#consumed.clear();
      derivedCtx = [this, this[Depth]];

      Cell.batch(() => {
        this.pending.set(true);
        this.error.set(null);
      });

      this.#controller?.abort();
      this.#controller = new AbortController();

      /** @type {null | ((value: boolean) => void)} */
      let resolveChangedState = null;
      /** @type {Promise<boolean>} */
      const valueHasChanged = new Promise((resolve) => {
        resolveChangedState = resolve;
      });
      // if this cell discards this promise and starts another,
      // we do not want to its children to be stuck waiting for the old.
      // We are not using signal.addEventListener('abort') here because
      // the controller aborts too early (before the next promise even starts),
      // and we want the next promise to already be notified to the children,
      // so they don't resolve prematurely.
      /** @type {undefined | (() => void)} */
      let abandonComputation;
      /** @type {Promise<T | null>} */
      const tripwire = new Promise((resolve) => {
        abandonComputation = () => resolve(lastStablePromise);
      });

      const current = Promise.race([
        tripwire,
        new Promise((resolve) => resolve(fn(get, this._signal))),
      ])
        .catch((error) => {
          if (currentRunId === runId) {
            Cell.batch(() => {
              this.pending.set(false);
              this.error.set(error);
            });
          }
          return lastStablePromise;
        })
        .then(async (value) => {
          if (currentRunId === runId) {
            this.pending.set(false);
            resolveChangedState?.(!deepEqual(await lastStablePromise, value));
          } else {
            resolveChangedState?.(false);
          }
          return value;
        });
      this.wvalue = current;

      this.#notify(current, valueHasChanged, lastStablePromise, initialState);
      this.#abandonLastComputation?.();
      this.#abandonLastComputation = abandonComputation;

      current.finally(async () => {
        if (currentRunId !== runId) return;
        if (lastStablePromise === initialState) {
          // We only run update() for subsequent changes, not initial resolution.
          lastStablePromise = current;
          return;
        }
        lastStablePromise = current;
        if (derivedCtx[1] + 1 > this[Depth]) this[Depth] = derivedCtx[1] + 1;
        if (await valueHasChanged) this.update();
      });

      return this.wvalue;
    };
    // First call.
    this.computedFn();
  }

  /**
   * @param {Promise<any>} promise
   * @param {Promise<boolean>} valueHasChanged
   * @param {Promise<any>} lastStablePromise
   * @param {Promise<any>} initialState
   */
  #notify(promise, valueHasChanged, lastStablePromise, initialState) {
    for (const child of this.derivations) {
      if (!(child instanceof AsyncDerivedCell)) continue;
      if (child.#upstream.has(promise)) continue;

      // Only direct children should be scheduled based on this cell's valueHasChanged.
      // Grandchildren will be scheduled by their direct parent when it computes.
      promise.then(async () => {
        child.#upstream.delete(promise);
        if (lastStablePromise === initialState) {
          return;
        }
        // If the child is already computing and it has not tried to read the parent,
        // it need not be restarted. When it tries to access the parent,
        // it will receive the most recent value.
        if (child.pending.peek() && !child.#consumed.has(this)) {
          return;
        }
        if (!child[IsScheduled] && (await valueHasChanged)) {
          UPDATE_BUFFER.push(child);
          if (!IS_UPDATING) triggerUpdate();
        }
      });
      child.#upstream.add(promise);
      // Propagate ONLY the upstream waiting to grandchildren (not the scheduling).
      // This ensures grandchildren wait for this ancestor to complete,
      // but they'll be scheduled by their direct parent's #notify, not ours.
      child.#notifyUpstreamOnly(promise);
    }
  }

  /**
   * Propagates upstream tracking to grandchildren without scheduling them.
   * This ensures they wait for the ancestor to complete when calling .get().
   * @param {Promise<any>} promise
   */
  #notifyUpstreamOnly(promise) {
    for (const child of this.derivations) {
      if (!(child instanceof AsyncDerivedCell)) continue;
      if (child.#upstream.has(promise)) continue;

      child.#upstream.add(promise);
      promise.finally(() => child.#upstream.delete(promise));
      // Continue propagating upstream tracking down the chain
      child.#notifyUpstreamOnly(promise);
    }
  }

  /**
   * Returns the current value of the async cell.
   * @returns {Promise<T>}
   */
  async get() {
    super.get(); // Forces a dependency registration in sync time.
    while (this.#upstream.size) await Promise.allSettled([...this.#upstream]);
    return new Promise((resolve) => {
      if (this.pending.peek()) {
        this.pending.listen(() => resolve(this.wvalue), { once: true });
      } else resolve(this.wvalue);
    });
  }

  [DisposeAsyncCell]() {
    this.#controller?.abort();
    this.#abandonLastComputation?.();
  }
  /**
   * Returns the current value of the async cell without registering dependencies.
   * Like get(), this waits for upstream promises and pending state to resolve,
   * but it does not register this cell as a dependency of the calling context.
   * @returns {Promise<T>} A promise that resolves to the current value.
   */
  async peek() {
    while (this.#upstream.size) await Promise.allSettled([...this.#upstream]);
    return new Promise((resolve) => {
      if (this.pending.peek()) {
        this.pending.listen(() => resolve(this.wvalue), { once: true });
      } else {
        resolve(this.wvalue);
      }
    });
  }
}

/**
 * A derived cell that computes its value asynchronously.
 *
 * AsyncDerivedCell extends the reactive paradigm to asynchronous operations,
 * automatically re-running the async computation when dependencies change.
 * It provides built-in state management for loading and error states.
 *
 * Key features:
 * - Automatic dependency tracking via the `get` function
 * - Automatic cancellation of in-flight operations when dependencies change
 * - Built-in `pending` cell for loading state
 * - Built-in `error` cell for error handling
 * - Race condition prevention through AbortSignal
 *
 * @template {*} out T - The type of the resolved async value.
 * @extends {AsyncCell<T>}
 *
 * @example
 * ```javascript
 * const searchQuery = Cell.source('');
 *
 * const searchResults = Cell.derivedAsync(async (get, signal) => {
 *   const query = get(searchQuery);
 *   if (!query) return [];
 *
 *   const response = await fetch(`/api/search?q=${query}`, { signal });
 *   return response.json();
 * });
 *
 * // React to state changes
 * searchResults.pending.listen((loading) => {
 *   showSpinner(loading);
 * });
 *
 * searchResults.error.listen((error) => {
 *   if (error) showError(error.message);
 * });
 * ```
 */
export class AsyncDerivedCell extends AsyncCell {
  /**
   * Revalidates the async cell by recomputing its value.
   * This will abort any in-flight computation and start a new one.
   * @returns {void}
   */
  revalidate() {
    this.computedFn();
  }
}

/**
 * @template I, O
 * @typedef {(input: I, signal: AbortSignal) => Promise<O>} MutatorFn
 */

/**
 * A task cell that performs one-time asynchronous computations.
 *
 * AsyncTaskCell is designed for operations that should only execute when explicitly
 * triggered, unlike AsyncDerivedCell which re-computes automatically. This makes it
 * ideal for form submissions, button actions, or any user-triggered operations.
 *
 * Key features:
 * - Only executes when `runWith(input)` is called
 * - Does not deduplicate concurrent `runWith(input)` calls; each call creates
 *   an independent execution with no caching
 * - Built-in `pending` cell for loading state (false until first execution)
 * - Built-in `error` cell for error handling
 * - Supports cancellation via AbortSignal (concurrent cancellations must be
 *   handled in the task function)
 * - Can be used with Cell.composite for grouping multiple tasks
 *
 * @template {*} out I - The input type of the task function.
 * @template {*} out T - The type of the resolved async value.
 * @extends {AsyncCell<T>}
 *
 * @example
 * ```javascript
 * import { Cell } from '@adbl/cells';
 *
 * // Create a task for user login
 * const loginTask = Cell.task(async (credentials, signal) => {
 *   const response = await fetch('/api/login', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(credentials),
 *     signal
 *   });
 *
 *   if (!response.ok) {
 *     throw new Error('Login failed');
 *   }
 *
 *   return response.json();
 * });
 *
 * // Execute the task
 * loginTask.runWith({ username: 'john', password: 'secret' });
 *
 * // Monitor states
 * loginTask.pending.listen((isPending) => {
 *   submitButton.disabled = isPending;
 *   submitButton.textContent = isPending ? 'Logging in...' : 'Login';
 * });
 *
 * loginTask.error.listen((error) => {
 *   if (error) {
 *     errorMessage.textContent = error.message;
 *   }
 * });
 *
 * loginTask.listen(async (promise) => {
 *   const user = await promise;
 *   console.log('Logged in as:', user.name);
 * });
 * ```
 *
 * @example
 * ```javascript
 * const fetchTask = Cell.task(async (id) => {
 *   console.log('Fetching user', id);
 *   await delay(1000);
 *   return { id, name: 'User ' + id };
 * });
 *
 * // Execute the task
 * const user = await fetchTask.runWith(1);
 * console.log(user.name);
 *
 * // Execute again - each call creates a new execution
 * const anotherUser = await fetchTask.runWith(2);
 * ```
 */
export class AsyncTaskCell extends AsyncCell {
  /** @param {MutatorFn<I, T>} fn */
  constructor(fn) {
    let currentInput = /** @type {I} */ (null);
    // currentInput may be null; hasInput indicates whether runWith has been called.
    /** @type {boolean} */
    let hasInput = false;

    const computedFn = () => {
      if (!hasInput) return Promise.resolve(/** @type {T} */ (null));
      const capturedInput = currentInput;
      return fn(capturedInput, this._signal);
    };

    super(computedFn);

    // AsyncTaskCell should not be pending until runWith is called
    this.pending.set(false);

    let hasExecuted = false;
    this.update = this.update.bind(this);

    /**
     * Executes the task with the provided input.
     *
     * Each call to runWith creates a new execution of the task function.
     * Concurrent calls are not deduplicated or cached. If you need to cancel
     * work in progress, use the provided AbortSignal and handle it inside the
     * task function.
     *
     * @param {I} input - The input value to pass to the task function.
     * @returns {Promise<T | null>} A promise that resolves with the task result,
     *   or null if the task hasn't been executed yet.
     *
     * @example
     * ```javascript
     * const task = Cell.task(async (userId) => {
     *   const response = await fetch(`/api/users/${userId}`);
     *   return response.json();
     * });
     *
     * // Execute the task
     * const user = await task.runWith(123);
     * console.log(user.name);
     *
     * // Execute again with different input
     * const anotherUser = await task.runWith(456);
     * ```
     */
    this.runWith = async (input) => {
      const isFirstExecution = !hasExecuted;
      this.abort();
      currentInput = input;
      hasInput = true;
      const value = this.computedFn();
      hasExecuted = true;

      // For the first execution, we need to manually trigger an update
      // since AsyncCell skips update() for the initial state.
      // We also need to schedule AsyncDerivedCell children for recomputation.
      if (isFirstExecution) {
        value.then(() => {
          this.update();
          // Schedule AsyncDerivedCell children for recomputation
          for (const child of this.derivations) {
            if (child instanceof AsyncDerivedCell && !child[IsScheduled]) {
              UPDATE_BUFFER.push(child);
              child[IsScheduled] = true;
            }
          }
          if (!IS_UPDATING) triggerUpdate();
        });
      }

      return value;
    };
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
    a === null ||
    typeof a !== 'object' ||
    b === null ||
    typeof b !== 'object'
  ) {
    return false;
  }

  if (a.constructor !== b.constructor) return false;

  if (a instanceof Date) return a.getTime() === b.getTime();

  if (a instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  if (a instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }

  if (a instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  if (Array.isArray(a)) {
    const length = a.length;
    if (length !== b.length) return false;

    for (let i = 0; i < length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const length = keysA.length;

  if (Object.keys(b).length !== length) return false;

  for (let i = 0; i < length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !deepEqual(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
}

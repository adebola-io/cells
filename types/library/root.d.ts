export namespace root {
    let globalPreEffects: [Partial<GlobalEffectOptions>, ((value: unknown) => void)][];
    let globalPostEffects: [Partial<GlobalEffectOptions>, ((value: unknown) => void)][];
    let batchNestingLevel: number;
    let batchedEffects: Map<Function, any[]>;
}
/**
 * A value representing the computed values that are currently being calculated.
 * It is an array so it can keep track of nested computed values.
 * @type {[DerivedCell, () => any][]}
 */
export const activeComputedValues: [import("./classes.js").DerivedCell<any>, () => any][];
export type Watchable = import('./classes.js').Cell<any>;
export type DerivedCell = import('./classes.js').DerivedCell<any>;
export type GlobalEffectOptions = {
    /**
     * - Whether the effect should be removed after the first run.
     */
    runOnce: boolean;
    /**
     * - Whether the effect should be run even if the cell is a derived cell.
     */
    ignoreDerivedCells: boolean;
};

export default Signal;
import { SourceSignal } from './classes.js';
import { DerivedSignal } from './classes.js';
export namespace Signal {
    function beforeUpdate(effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined): number;
    function afterUpdate(effect: (value: unknown) => void, options?: Partial<import("./root.js").GlobalEffectOptions> | undefined): void;
    function removeGlobalEffects(): void;
    function removeGlobalEffect(effect: (value: unknown) => void): void;
    function source<T>(value: T): SourceSignal<T>;
    function derived<T>(callback: () => T): DerivedSignal<T>;
    function batch(callback: () => void): void;
}
export { SourceSignal, DerivedSignal };

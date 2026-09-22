import { ArgoAnnotations } from '@/domain/models/argocd/ArgoAnnotations'

// Whether deleting an application also deletes what it deployed is decided by one finalizer,
// so a cascade choice is a change to metadata.finalizers made before the delete.
export class ArgoFinalizers {
    public static desired(finalizers: readonly string[], cascade: boolean): string[] {
        const without = finalizers.filter(finalizer => finalizer !== ArgoAnnotations.resourcesFinalizer)

        return cascade ? [...without, ArgoAnnotations.resourcesFinalizer] : without
    }

    public static hasCascade(finalizers: readonly string[]): boolean {
        return finalizers.includes(ArgoAnnotations.resourcesFinalizer)
    }

    public static same(left: readonly string[], right: readonly string[]): boolean {
        return left.length === right.length && left.every((value, index) => value === right[index])
    }
}

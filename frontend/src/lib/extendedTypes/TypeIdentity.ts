import { ExtendedTypeInfo } from '@/lib/extendedTypes/ExtendedTypeInfo'

// Keyed by the class object itself: a subclass must not inherit the identity of
// its base, or the bus would route its events to the base's handlers.
export class TypeIdentity {
    private static readonly registry = new WeakMap<object, ExtendedTypeInfo>()

    public static of(target: object): ExtendedTypeInfo {
        const known = TypeIdentity.registry.get(target)
        if (known) {
            return known
        }

        const created = new ExtendedTypeInfo()
        TypeIdentity.registry.set(target, created)
        return created
    }

    public static guid(target: object): string {
        return TypeIdentity.of(target).guid
    }
}

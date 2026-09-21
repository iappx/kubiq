import { ExtendedTypeInfo } from '@/lib/extendedTypes/ExtendedTypeInfo'

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

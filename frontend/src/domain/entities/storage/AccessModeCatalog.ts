export class AccessModeCatalog {
    public static readonly values: Record<string, string> = {
        ReadWriteOnce: 'Read-write by one node',
        ReadOnlyMany: 'Read-only by many nodes',
        ReadWriteMany: 'Read-write by many nodes',
        ReadWriteOncePod: 'Read-write by one pod',
    }

    public static readonly shortValues: Record<string, string> = {
        ReadWriteOnce: 'RWO',
        ReadOnlyMany: 'ROX',
        ReadWriteMany: 'RWX',
        ReadWriteOncePod: 'RWOP',
    }

    public static title(mode: string): string {
        return AccessModeCatalog.values[mode] ?? mode
    }

    public static short(mode: string): string {
        return AccessModeCatalog.shortValues[mode] ?? mode
    }

    public static has(mode: string): boolean {
        return Object.prototype.hasOwnProperty.call(AccessModeCatalog.values, mode)
    }
}

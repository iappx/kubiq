import type { TClusterIconKind } from '@/domain/entities/catalog/types/TClusterIconKind'

export class ClusterIconKindCatalog {
    public static readonly fallback: TClusterIconKind = 'initials'

    public static readonly values: Record<TClusterIconKind, string> = {
        initials: 'Initials',
        glyph: 'Icon',
        image: 'Image',
    }

    public static keys(): TClusterIconKind[] {
        return Object.keys(ClusterIconKindCatalog.values) as TClusterIconKind[]
    }

    public static title(kind: TClusterIconKind): string {
        return ClusterIconKindCatalog.values[kind] ?? kind
    }

    public static has(kind: string): kind is TClusterIconKind {
        return Object.prototype.hasOwnProperty.call(ClusterIconKindCatalog.values, kind)
    }

    public static of(kind: string | null | undefined): TClusterIconKind {
        return kind && ClusterIconKindCatalog.has(kind) ? kind : ClusterIconKindCatalog.fallback
    }
}

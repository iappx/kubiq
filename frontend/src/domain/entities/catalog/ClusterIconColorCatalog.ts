import type { TClusterIconColor } from '@/domain/entities/catalog/types/TClusterIconColor'

export class ClusterIconColorCatalog {
    public static readonly fallback: TClusterIconColor = 'teal'

    public static readonly values: Record<TClusterIconColor, string> = {
        teal: 'Teal',
        violet: 'Violet',
        blue: 'Blue',
        magenta: 'Magenta',
        amber: 'Amber',
        green: 'Green',
        red: 'Red',
        slate: 'Slate',
    }

    public static keys(): TClusterIconColor[] {
        return Object.keys(ClusterIconColorCatalog.values) as TClusterIconColor[]
    }

    public static title(color: TClusterIconColor): string {
        return ClusterIconColorCatalog.values[color] ?? color
    }

    public static has(color: string): color is TClusterIconColor {
        return Object.prototype.hasOwnProperty.call(ClusterIconColorCatalog.values, color)
    }

    public static of(color: string | null | undefined): TClusterIconColor {
        return color && ClusterIconColorCatalog.has(color) ? color : ClusterIconColorCatalog.fallback
    }
}

import type { TClusterIconGlyph } from '@/domain/entities/catalog/types/TClusterIconGlyph'

export class ClusterIconGlyphCatalog {
    public static readonly fallback: TClusterIconGlyph = 'server'

    public static readonly values: Record<TClusterIconGlyph, string> = {
        server: 'Server',
        cloud: 'Cloud',
        database: 'Database',
        flask: 'Flask',
        shield: 'Shield',
        box: 'Box',
        globe: 'Globe',
        cpu: 'Processor',
        rocket: 'Rocket',
        flame: 'Flame',
        bug: 'Bug',
        lock: 'Lock',
        building: 'Building',
        house: 'House',
        wrench: 'Wrench',
        zap: 'Lightning',
    }

    public static keys(): TClusterIconGlyph[] {
        return Object.keys(ClusterIconGlyphCatalog.values) as TClusterIconGlyph[]
    }

    public static title(glyph: TClusterIconGlyph): string {
        return ClusterIconGlyphCatalog.values[glyph] ?? glyph
    }

    public static has(glyph: string): glyph is TClusterIconGlyph {
        return Object.prototype.hasOwnProperty.call(ClusterIconGlyphCatalog.values, glyph)
    }

    public static of(glyph: string | null | undefined): TClusterIconGlyph {
        return glyph && ClusterIconGlyphCatalog.has(glyph) ? glyph : ClusterIconGlyphCatalog.fallback
    }
}

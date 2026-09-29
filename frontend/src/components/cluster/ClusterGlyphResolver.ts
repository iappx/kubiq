import type { Component as VueComponent } from 'vue'
import {
    Box,
    Bug,
    Building2,
    Cloud,
    Cpu,
    Database,
    Flame,
    FlaskConical,
    Globe,
    House,
    Lock,
    Rocket,
    Server,
    Shield,
    Wrench,
    Zap,
} from '@lucide/vue'
import type { TClusterIconGlyph } from '@/domain/entities/catalog/types/TClusterIconGlyph'

export class ClusterGlyphResolver {
    public static readonly fallback: VueComponent = Server

    private static readonly icons: Record<TClusterIconGlyph, VueComponent> = {
        server: Server,
        cloud: Cloud,
        database: Database,
        flask: FlaskConical,
        shield: Shield,
        box: Box,
        globe: Globe,
        cpu: Cpu,
        rocket: Rocket,
        flame: Flame,
        bug: Bug,
        lock: Lock,
        building: Building2,
        house: House,
        wrench: Wrench,
        zap: Zap,
    }

    public static resolve(glyph: string): VueComponent {
        return Object.prototype.hasOwnProperty.call(ClusterGlyphResolver.icons, glyph)
            ? ClusterGlyphResolver.icons[glyph as TClusterIconGlyph]
            : ClusterGlyphResolver.fallback
    }
}

import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterIconGlyphCatalog } from '@/domain/entities/catalog/ClusterIconGlyphCatalog'
import type { TClusterIcon } from '@/domain/entities/catalog/types/TClusterIcon'
import type { TClusterIconColor } from '@/domain/entities/catalog/types/TClusterIconColor'

export class ClusterMonogram {
    public static readonly maxLength: number = 4

    public static readonly placeholder: string = '?'

    private static readonly generatedLength: number = 2

    private static readonly separators: RegExp = /[^\p{L}\p{N}]+/u

    private static readonly camelHump: RegExp = /(\p{Ll})(\p{Lu})/gu

    public static iconFor(name: string): TClusterIcon {
        return {
            kind: 'initials',
            initials: ClusterMonogram.initialsOf(name),
            color: ClusterMonogram.colorOf(name),
            glyph: ClusterIconGlyphCatalog.fallback,
            imageUrl: '',
        }
    }

    public static initialsOf(name: string): string {
        const words = ClusterMonogram.wordsOf(ClusterMonogram.lastSegmentOf(name.trim()))

        if (words.length === 0) {
            return ClusterMonogram.placeholder
        }

        const letters = words.length > 1
            ? words.slice(0, ClusterMonogram.generatedLength).map(word => Array.from(word)[0]).join('')
            : Array.from(words[0]).slice(0, ClusterMonogram.generatedLength).join('')

        return letters.toUpperCase()
    }

    public static normalize(initials: string): string {
        return Array.from(initials.replace(/\s+/g, ''))
            .slice(0, ClusterMonogram.maxLength)
            .join('')
            .toUpperCase()
    }

    public static colorOf(name: string): TClusterIconColor {
        const colors = ClusterIconColorCatalog.keys()

        return colors[ClusterMonogram.hashOf(name) % colors.length]
    }

    // An EKS context is named by its ARN, and the cluster's own name is what follows the last slash.
    private static lastSegmentOf(name: string): string {
        const slash = name.lastIndexOf('/')

        return slash >= 0 && slash < name.length - 1 ? name.slice(slash + 1) : name
    }

    private static wordsOf(name: string): string[] {
        return name
            .replace(ClusterMonogram.camelHump, '$1 $2')
            .split(ClusterMonogram.separators)
            .filter(word => word !== '')
    }

    private static hashOf(text: string): number {
        // FNV-1a offset basis and prime.
        let hash = 0x811c9dc5

        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index)
            hash = Math.imul(hash, 0x01000193)
        }

        return hash >>> 0
    }
}

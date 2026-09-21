import type { TKubeDataMap } from '@/domain/entities/config/types/TKubeDataMap'

export class KubeDataMapReader {
    public static keysOf(map: TKubeDataMap | undefined): string[] {
        return Object.keys(map ?? {}).sort((a, b) => a.localeCompare(b))
    }

    public static sizeOf(map: TKubeDataMap | undefined, key: string): number {
        return KubeDataMapReader.decode(map, key).length
    }

    public static decode(map: TKubeDataMap | undefined, key: string): string {
        const encoded = (map ?? {})[key]
        if (typeof encoded !== 'string' || encoded === '') {
            return ''
        }

        try {
            return KubeDataMapReader.fromBase64(encoded)
        } catch {
            return ''
        }
    }

    public static plain(map: TKubeDataMap | undefined, key: string): string {
        const value = (map ?? {})[key]

        return typeof value === 'string' ? value : ''
    }

    public static isPrintable(value: string): boolean {
        if (value.length === 0) {
            return false
        }

        for (let i = 0; i < value.length; i++) {
            const code = value.charCodeAt(i)
            // Tab, the line breaks and form feed are printable here; the rest of C0 is not.
            if (code < 9 || (code > 13 && code < 32)) {
                return false
            }
        }

        return true
    }

    private static fromBase64(encoded: string): string {
        const binary = atob(encoded)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i)
        }

        return new TextDecoder().decode(bytes)
    }
}

export class MonacoHslColor {
    public static readonly fallback: string = '#000000'

    // Tokens are stored as the bare `H S% L%` triple hsl() takes, and Monaco's
    // theme API only understands hex — with an optional alpha byte.
    public static toHex(token: string, alpha: number = 1): string {
        const parts = MonacoHslColor.parse(token)
        if (!parts) {
            return MonacoHslColor.fallback
        }

        const [hue, saturation, lightness] = parts
        const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
        const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
        const match = lightness - chroma / 2
        const [red, green, blue] = MonacoHslColor.channels(hue, chroma, second)

        return `#${MonacoHslColor.byte(red + match)}${MonacoHslColor.byte(green + match)}${MonacoHslColor.byte(blue + match)}${MonacoHslColor.alpha(alpha)}`
    }

    private static parse(token: string): [number, number, number] | null {
        const cleaned = token.trim().replace(/^hsla?\(/, '').replace(/\)$/, '').replace(/\//g, ' ')
        const numbers = cleaned.split(/[\s,]+/).filter(part => part !== '').slice(0, 3).map(part => Number.parseFloat(part))

        if (numbers.length < 3 || numbers.some(number => Number.isNaN(number))) {
            return null
        }

        return [((numbers[0] % 360) + 360) % 360, numbers[1] / 100, numbers[2] / 100]
    }

    private static channels(hue: number, chroma: number, second: number): [number, number, number] {
        if (hue < 60) {
            return [chroma, second, 0]
        }
        if (hue < 120) {
            return [second, chroma, 0]
        }
        if (hue < 180) {
            return [0, chroma, second]
        }
        if (hue < 240) {
            return [0, second, chroma]
        }
        if (hue < 300) {
            return [second, 0, chroma]
        }

        return [chroma, 0, second]
    }

    private static byte(value: number): string {
        return Math.round(Math.min(Math.max(value, 0), 1) * 255).toString(16).padStart(2, '0')
    }

    private static alpha(value: number): string {
        return value >= 1 ? '' : MonacoHslColor.byte(value)
    }
}

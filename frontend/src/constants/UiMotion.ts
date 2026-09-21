export class UiMotion {
    public static readonly instantMs = 80

    public static readonly fastMs = 120

    public static readonly normalMs = 180

    public static readonly moderateMs = 260

    public static readonly flashMs = 600

    public static readonly staggerMs = 30

    public static readonly staggerCapMs = 300

    public static readonly easeStandard: [number, number, number, number] = [0.2, 0, 0, 1]

    public static readonly easeOut: [number, number, number, number] = [0, 0, 0.2, 1]

    public static readonly easeIn: [number, number, number, number] = [0.3, 0, 1, 0.3]

    public static get instant(): number {
        return UiMotion.seconds(UiMotion.instantMs)
    }

    public static get fast(): number {
        return UiMotion.seconds(UiMotion.fastMs)
    }

    public static get normal(): number {
        return UiMotion.seconds(UiMotion.normalMs)
    }

    public static get moderate(): number {
        return UiMotion.seconds(UiMotion.moderateMs)
    }

    public static get flash(): number {
        return UiMotion.seconds(UiMotion.flashMs)
    }

    public static get reduced(): boolean {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false
        }
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    public static stagger(index: number): number {
        const offset = Math.min(Math.max(index, 0) * UiMotion.staggerMs, UiMotion.staggerCapMs)
        return UiMotion.seconds(offset)
    }

    private static seconds(milliseconds: number): number {
        return UiMotion.reduced ? 0 : milliseconds / 1000
    }
}

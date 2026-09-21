export class UiResizeController {
    public static readonly defaultStep = 16

    public static clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max)
    }

    public static fromKey(
        key: string,
        value: number,
        min: number,
        max: number,
        step: number,
        orientation: 'vertical' | 'horizontal',
        invert: boolean,
    ): number | null {
        if (key === 'Home') {
            return min
        }
        if (key === 'End') {
            return max
        }

        const delta = UiResizeController.delta(key, step, orientation, invert)
        if (delta === null) {
            return null
        }
        return UiResizeController.clamp(value + delta, min, max)
    }

    public static fromPointer(
        start: number,
        position: number,
        startValue: number,
        min: number,
        max: number,
        invert: boolean,
    ): number {
        const travel = invert ? start - position : position - start
        return UiResizeController.clamp(startValue + travel, min, max)
    }

    private static delta(
        key: string,
        step: number,
        orientation: 'vertical' | 'horizontal',
        invert: boolean,
    ): number | null {
        const sign = invert ? -1 : 1

        if (orientation === 'vertical') {
            if (key === 'ArrowLeft') {
                return -step * sign
            }
            if (key === 'ArrowRight') {
                return step * sign
            }
            return null
        }

        if (key === 'ArrowUp') {
            return -step * sign
        }
        if (key === 'ArrowDown') {
            return step * sign
        }
        return null
    }
}

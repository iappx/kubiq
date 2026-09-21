import { afterEach, describe, expect, it } from 'vitest'
import { UiMotion } from '@/constants/UiMotion'

const original = window.matchMedia

const prefersReducedMotion = (matches: boolean): void => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({ matches, media: query }),
    })
}

describe('UiMotion', () => {
    afterEach(() => {
        Object.defineProperty(window, 'matchMedia', { writable: true, value: original })
    })

    it('mirrors the css tokens in the seconds motion-v expects', () => {
        expect(UiMotion.instant).toBeCloseTo(0.08)
        expect(UiMotion.fast).toBeCloseTo(0.12)
        expect(UiMotion.normal).toBeCloseTo(0.18)
        expect(UiMotion.moderate).toBeCloseTo(0.26)
        expect(UiMotion.flash).toBeCloseTo(0.6)
    })

    it('keeps the millisecond values the stylesheet declares', () => {
        expect(UiMotion.instantMs).toBe(80)
        expect(UiMotion.fastMs).toBe(120)
        expect(UiMotion.normalMs).toBe(180)
        expect(UiMotion.moderateMs).toBe(260)
        expect(UiMotion.flashMs).toBe(600)
    })

    it('reports zero for every duration once reduced motion is asked for', () => {
        prefersReducedMotion(true)

        expect(UiMotion.reduced).toBe(true)
        expect(UiMotion.instant).toBe(0)
        expect(UiMotion.fast).toBe(0)
        expect(UiMotion.normal).toBe(0)
        expect(UiMotion.moderate).toBe(0)
        expect(UiMotion.flash).toBe(0)
        expect(UiMotion.stagger(4)).toBe(0)
    })

    it('reads the preference at call time, so a change mid-session is picked up', () => {
        prefersReducedMotion(false)
        expect(UiMotion.normal).toBeCloseTo(0.18)

        prefersReducedMotion(true)
        expect(UiMotion.normal).toBe(0)

        prefersReducedMotion(false)
        expect(UiMotion.normal).toBeCloseTo(0.18)
    })

    it('staggers by 30 ms and caps the whole sequence at 300 ms', () => {
        expect(UiMotion.stagger(0)).toBe(0)
        expect(UiMotion.stagger(1)).toBeCloseTo(0.03)
        expect(UiMotion.stagger(10)).toBeCloseTo(0.3)
        expect(UiMotion.stagger(40)).toBeCloseTo(0.3)
    })

    it('treats an environment with no matchMedia as full motion', () => {
        Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined })

        expect(UiMotion.reduced).toBe(false)
        expect(UiMotion.normal).toBeCloseTo(0.18)
    })
})

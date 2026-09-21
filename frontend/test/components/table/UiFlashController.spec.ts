import { describe, expect, it } from 'vitest'
import { UiFlashController } from '@/components/common/table/UiFlashController'

describe('UiFlashController', () => {
    it('tints a key for the flash duration and no longer', () => {
        const controller = new UiFlashController()

        controller.flash(['pod-1'], 1000)

        expect(controller.has('pod-1', 1500)).toBe(true)
        expect(controller.has('pod-1', 1600)).toBe(false)
    })

    it('counts a relist as one event however many rows it touched', () => {
        const controller = new UiFlashController()

        controller.flash(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], 1000)

        expect(controller.isSuppressed(1000)).toBe(false)
        expect(controller.keys()).toHaveLength(9)
    })

    it('keeps tinting up to eight events inside one second', () => {
        const controller = new UiFlashController()

        for (let i = 0; i < 8; i++) {
            expect(controller.flash([`pod-${i}`], 1000 + i * 10)).toBe(true)
        }

        expect(controller.isSuppressed(1080)).toBe(false)
        expect(controller.keys()).toHaveLength(8)
    })

    it('suppresses the tint entirely once a burst passes eight events a second', () => {
        const controller = new UiFlashController()

        for (let i = 0; i < 8; i++) {
            controller.flash([`pod-${i}`], 1000 + i * 10)
        }

        expect(controller.flash(['pod-8'], 1090)).toBe(false)
        expect(controller.isSuppressed(1090)).toBe(true)
        expect(controller.keys()).toEqual([])
    })

    it('resumes tinting once the burst has fallen out of the window', () => {
        const controller = new UiFlashController()

        for (let i = 0; i < 9; i++) {
            controller.flash([`pod-${i}`], 1000 + i * 10)
        }

        expect(controller.flash(['later'], 3000)).toBe(true)
        expect(controller.has('later', 3000)).toBe(true)
        expect(controller.isSuppressed(3000)).toBe(false)
    })

    it('honours a burst limit and window the caller chose', () => {
        const controller = new UiFlashController(200, 2, 500)

        expect(controller.flash(['a'], 0)).toBe(true)
        expect(controller.flash(['b'], 100)).toBe(true)
        expect(controller.flash(['c'], 200)).toBe(false)
        expect(controller.keys()).toEqual([])
    })

    it('drops expired keys on prune and reports when nothing is left', () => {
        const controller = new UiFlashController()
        controller.flash(['pod-1'], 0)

        expect(controller.prune(100)).toBe(false)
        expect(controller.active).toBe(true)
        expect(controller.prune(600)).toBe(true)
        expect(controller.active).toBe(false)
    })
})

import { describe, expect, it } from 'vitest'
import { UiResizeController } from '@/components/common/panel/UiResizeController'

describe('UiResizeController', () => {
    it('moves a vertical separator one step per arrow key', () => {
        expect(UiResizeController.fromKey('ArrowRight', 500, 420, 880, 16, 'vertical', false)).toBe(516)
        expect(UiResizeController.fromKey('ArrowLeft', 500, 420, 880, 16, 'vertical', false)).toBe(484)
    })

    it('grows the pane that sits after the separator when inverted', () => {
        expect(UiResizeController.fromKey('ArrowLeft', 500, 420, 880, 16, 'vertical', true)).toBe(516)
        expect(UiResizeController.fromKey('ArrowRight', 500, 420, 880, 16, 'vertical', true)).toBe(484)
    })

    it('answers to the arrows that match its own orientation and no others', () => {
        expect(UiResizeController.fromKey('ArrowUp', 300, 120, 640, 16, 'horizontal', true)).toBe(316)
        expect(UiResizeController.fromKey('ArrowUp', 500, 420, 880, 16, 'vertical', false)).toBeNull()
        expect(UiResizeController.fromKey('ArrowRight', 300, 120, 640, 16, 'horizontal', false)).toBeNull()
        expect(UiResizeController.fromKey('PageDown', 500, 420, 880, 16, 'vertical', false)).toBeNull()
    })

    it('jumps to the bounds on Home and End regardless of orientation', () => {
        expect(UiResizeController.fromKey('Home', 500, 420, 880, 16, 'vertical', false)).toBe(420)
        expect(UiResizeController.fromKey('End', 500, 420, 880, 16, 'vertical', true)).toBe(880)
        expect(UiResizeController.fromKey('Home', 300, 120, 640, 16, 'horizontal', true)).toBe(120)
    })

    it('never steps past a bound', () => {
        expect(UiResizeController.fromKey('ArrowLeft', 424, 420, 880, 16, 'vertical', false)).toBe(420)
        expect(UiResizeController.fromKey('ArrowRight', 876, 420, 880, 16, 'vertical', false)).toBe(880)
    })

    it('clamps a pointer drag to the same bounds', () => {
        expect(UiResizeController.fromPointer(600, 400, 500, 420, 880, true)).toBe(700)
        expect(UiResizeController.fromPointer(600, 800, 500, 420, 880, true)).toBe(420)
        expect(UiResizeController.fromPointer(600, 800, 500, 420, 880, false)).toBe(700)
    })

    it('clamps a value on its own', () => {
        expect(UiResizeController.clamp(100, 420, 880)).toBe(420)
        expect(UiResizeController.clamp(1000, 420, 880)).toBe(880)
        expect(UiResizeController.clamp(500, 420, 880)).toBe(500)
    })
})

import { describe, expect, it } from 'vitest'
import { ShellKeymap } from '@/components/clusterShell/ShellKeymap'

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent =>
    ({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers }) as KeyboardEvent

describe('ShellKeymap.command', () => {
    it('opens the palette on Ctrl+K', () => {
        expect(ShellKeymap.command(press('k', { ctrlKey: true }), false)).toBe('palette')
    })

    it('opens the palette on Cmd+K', () => {
        expect(ShellKeymap.command(press('k', { metaKey: true }), false)).toBe('palette')
    })

    it('opens the palette on a shifted K, which is what the key reports with caps lock', () => {
        expect(ShellKeymap.command(press('K', { metaKey: true }), false)).toBe('palette')
    })

    it('opens the palette while the user is typing, the way every editor does', () => {
        expect(ShellKeymap.command(press('k', { ctrlKey: true }), true)).toBe('palette')
    })

    it('toggles the sidebar on Ctrl+\\', () => {
        expect(ShellKeymap.command(press('\\', { ctrlKey: true }), false)).toBe('sidebar')
    })

    it('leaves a bare k to the page', () => {
        expect(ShellKeymap.command(press('k'), false)).toBeNull()
    })

    it('leaves an Alt combination alone, so a browser accelerator keeps working', () => {
        expect(ShellKeymap.command(press('k', { ctrlKey: true, altKey: true }), false)).toBeNull()
    })

    it('claims Escape', () => {
        expect(ShellKeymap.command(press('Escape'), false)).toBe('escape')
    })

    it('leaves Escape to the field the user is typing in', () => {
        expect(ShellKeymap.command(press('Escape'), true)).toBeNull()
    })
})

describe('ShellKeymap.escapeTarget', () => {
    it('closes the panel first', () => {
        expect(ShellKeymap.escapeTarget({ panelOpen: true, dockOpen: true })).toBe('panel')
    })

    it('closes the dock once the panel is gone', () => {
        expect(ShellKeymap.escapeTarget({ panelOpen: false, dockOpen: true })).toBe('dock')
    })

    it('leaves the row cursor for last', () => {
        expect(ShellKeymap.escapeTarget({ panelOpen: false, dockOpen: false })).toBe('cursor')
    })

    it('never reaches the dock while the panel is open', () => {
        expect(ShellKeymap.escapeTarget({ panelOpen: true, dockOpen: false })).toBe('panel')
    })
})

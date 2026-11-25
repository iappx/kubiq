import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalEscapeStack } from '@/components/base/modals/ModalEscapeStack'
import { ShellKeymap } from '@/components/clusterShell/ShellKeymap'
import { UiKeyboard } from '@/components/common/UiKeyboard'

const dispatchEscape = (target: EventTarget = document): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    return event
}

describe('ModalEscapeStack', () => {
    afterEach(() => {
        ModalEscapeStack.clear()
        document.body.innerHTML = ''
    })

    it('tracks open modal state separately from panels', () => {
        const panel = Symbol('panel')
        const modal = Symbol('modal')

        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        ModalEscapeStack.push(panel, 'panel', () => {})
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)
        expect(ModalEscapeStack.isTop(panel)).toBe(true)

        ModalEscapeStack.push(modal, 'modal', () => {})
        expect(ModalEscapeStack.hasOpenModal()).toBe(true)
        expect(ModalEscapeStack.isTop(modal)).toBe(true)
        expect(ModalEscapeStack.isTop(panel)).toBe(false)

        ModalEscapeStack.remove(modal)
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)
        expect(ModalEscapeStack.isTop(panel)).toBe(true)
    })

    it('prioritizes modal tier over panel tier regardless of push order', () => {
        const modal = Symbol('modal')
        const panel = Symbol('panel')

        ModalEscapeStack.push(modal, 'modal', () => {})
        ModalEscapeStack.push(panel, 'panel', () => {})

        expect(ModalEscapeStack.isTop(modal)).toBe(true)
        expect(ModalEscapeStack.isTop(panel)).toBe(false)
    })

    it('resolves entries LIFO within the same tier and promotes re-pushed owners', () => {
        const first = Symbol('first')
        const second = Symbol('second')

        ModalEscapeStack.push(first, 'modal', () => {})
        ModalEscapeStack.push(second, 'modal', () => {})
        expect(ModalEscapeStack.isTop(second)).toBe(true)

        ModalEscapeStack.push(first, 'modal', () => {})
        expect(ModalEscapeStack.isTop(first)).toBe(true)
        expect(ModalEscapeStack.isTop(second)).toBe(false)

        ModalEscapeStack.remove(first)
        expect(ModalEscapeStack.isTop(second)).toBe(true)
    })

    it('invokes only the top entry on Escape even when onEscape synchronously removes itself', () => {
        const panel = Symbol('panel')
        const modal = Symbol('modal')
        const onPanel = vi.fn()
        const onModal = vi.fn(() => ModalEscapeStack.remove(modal))

        ModalEscapeStack.push(panel, 'panel', onPanel)
        ModalEscapeStack.push(modal, 'modal', onModal)

        const firstEvent = dispatchEscape()
        expect(firstEvent.defaultPrevented).toBe(true)
        expect(onModal).toHaveBeenCalledTimes(1)
        expect(onPanel).not.toHaveBeenCalled()

        const secondEvent = dispatchEscape()
        expect(secondEvent.defaultPrevented).toBe(true)
        expect(onPanel).toHaveBeenCalledTimes(1)
    })

    it('ignores non-Escape keys, defaultPrevented events, and events stopped by children', () => {
        const modal = Symbol('modal')
        const onModal = vi.fn()
        ModalEscapeStack.push(modal, 'modal', onModal)

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
        expect(onModal).not.toHaveBeenCalled()

        const prevented = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
        prevented.preventDefault()
        document.dispatchEvent(prevented)
        expect(onModal).not.toHaveBeenCalled()

        const child = document.createElement('input')
        document.body.appendChild(child)
        child.addEventListener('keydown', event => event.stopPropagation())
        dispatchEscape(child)
        expect(onModal).not.toHaveBeenCalled()
    })

    it('closes the top modal when Escape bubbles from a textarea inside the modal', () => {
        const panel = Symbol('panel')
        const modal = Symbol('modal')
        const onPanel = vi.fn()
        const onModal = vi.fn()

        ModalEscapeStack.push(panel, 'panel', onPanel)
        ModalEscapeStack.push(modal, 'modal', onModal)

        const textarea = document.createElement('textarea')
        document.body.appendChild(textarea)

        dispatchEscape(textarea)
        expect(onModal).toHaveBeenCalledTimes(1)
        expect(onPanel).not.toHaveBeenCalled()
    })

    it('yields to open modals from a capture-phase shell Escape listener before closing panel and dock', () => {
        const panel = Symbol('panel')
        const modal = Symbol('modal')
        let detailOpen = true
        let dockOpen = true
        const closeDetail = vi.fn(() => {
            detailOpen = false
            ModalEscapeStack.remove(panel)
        })
        const closeDock = vi.fn(() => {
            dockOpen = false
        })
        const onModal = vi.fn(() => ModalEscapeStack.remove(modal))
        const onPanelBubble = vi.fn()

        const captureListener = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || ModalEscapeStack.hasOpenModal()) {
                return
            }
            if (ShellKeymap.command(event, UiKeyboard.isTyping(event.target)) !== 'escape') {
                return
            }
            const target = ShellKeymap.escapeTarget({ panelOpen: detailOpen, dockOpen })
            if (target === 'panel') {
                closeDetail()
                event.preventDefault()
                event.stopPropagation()
                return
            }
            if (target === 'dock') {
                closeDock()
                event.preventDefault()
                event.stopPropagation()
            }
        }

        document.addEventListener('keydown', captureListener, true)
        try {
            ModalEscapeStack.push(panel, 'panel', onPanelBubble)
            ModalEscapeStack.push(modal, 'modal', onModal)

            dispatchEscape()
            expect(onModal).toHaveBeenCalledTimes(1)
            expect(closeDetail).not.toHaveBeenCalled()
            expect(onPanelBubble).not.toHaveBeenCalled()

            dispatchEscape()
            expect(closeDetail).toHaveBeenCalledTimes(1)
            expect(onPanelBubble).not.toHaveBeenCalled()
            expect(closeDock).not.toHaveBeenCalled()

            dispatchEscape()
            expect(closeDock).toHaveBeenCalledTimes(1)
        } finally {
            document.removeEventListener('keydown', captureListener, true)
        }
    })

    it('detaches the document listener once all entries are removed', () => {
        const modal = Symbol('modal')
        const onModal = vi.fn()
        ModalEscapeStack.push(modal, 'modal', onModal)
        ModalEscapeStack.remove(modal)

        const event = dispatchEscape()
        expect(event.defaultPrevented).toBe(false)
        expect(onModal).not.toHaveBeenCalled()
    })
})

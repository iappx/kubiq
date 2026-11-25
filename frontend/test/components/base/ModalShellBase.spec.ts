import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@iappx/vue-facing-di', () => ({
    Component: () => <T>(target: T): T => target,
    Prop: () => () => {},
    VModel: () => () => {},
    Watch: () => () => {},
    VueBase: class {
        public $refs: Record<string, unknown> = {}
    },
}))

import { ModalEscapeStack } from '@/components/base/modals/ModalEscapeStack'
import { ModalShellBase } from '@/components/base/modals/ModalShellBase'
import type { TModalLayer } from '@/components/base/modals/types/TModalLayer'
import { IdService } from '@/application/services/id/IdService'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import UiModal from '@/components/common/modal/UiModal.vue'
import UiSidePanel from '@/components/common/panel/UiSidePanel.vue'

class TestShell extends ModalShellBase {
    public open = false

    public escaped = 0

    private readonly layer: TModalLayer

    constructor(layer: TModalLayer) {
        super()
        this.layer = layer
    }

    public async setOpen(open: boolean): Promise<void> {
        this.open = open
        await this.handleOpenChange(open)
    }

    protected override escapeLayer(): TModalLayer {
        return this.layer
    }

    protected isOpen(): boolean {
        return this.open
    }

    protected onEscape(): void {
        this.escaped += 1
    }
}

const dispatchEscape = (): void => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

describe('ModalShellBase', () => {
    afterEach(() => {
        ModalEscapeStack.clear()
        document.body.innerHTML = ''
    })

    it('registers an initially open shell on mount and unregisters on unmount', () => {
        const modal = new TestShell('modal')
        modal.open = true
        modal.mounted()

        expect(ModalEscapeStack.hasOpenModal()).toBe(true)

        dispatchEscape()
        expect(modal.escaped).toBe(1)

        modal.beforeUnmount()
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        dispatchEscape()
        expect(modal.escaped).toBe(1)
    })

    it('routes Escape to an open modal ahead of an open side panel', async () => {
        const panel = new TestShell('panel')
        const modal = new TestShell('modal')
        panel.mounted()
        modal.mounted()

        await panel.setOpen(true)
        await modal.setOpen(true)

        expect(ModalEscapeStack.hasOpenModal()).toBe(true)

        dispatchEscape()
        expect(modal.escaped).toBe(1)
        expect(panel.escaped).toBe(0)

        await modal.setOpen(false)
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        dispatchEscape()
        expect(panel.escaped).toBe(1)

        panel.beforeUnmount()
        modal.beforeUnmount()
    })

    it('restores focus to the previous element when closing', async () => {
        const trigger = document.createElement('button')
        const input = document.createElement('input')
        const panelEl = document.createElement('div')
        panelEl.appendChild(input)
        document.body.appendChild(trigger)
        document.body.appendChild(panelEl)

        trigger.focus()
        expect(document.activeElement).toBe(trigger)

        const modal = new TestShell('modal')
        ;(modal as unknown as { $refs: Record<string, HTMLElement> }).$refs = { panel: panelEl }
        modal.mounted()

        await modal.setOpen(true)
        expect(document.activeElement).toBe(input)

        await modal.setOpen(false)
        expect(document.activeElement).toBe(trigger)

        modal.beforeUnmount()
    })

    it('closes UiModal over UiSidePanel and blocks Escape while UiModal is loading', () => {
        type TPanelHarness = {
            open: boolean
            $emit: ReturnType<typeof vi.fn>
            mounted: () => void
            beforeUnmount: () => void
            openChanged: (open: boolean) => void
        }
        type TModalHarness = TPanelHarness & {
            loading: boolean
        }

        const panel = new (UiSidePanel as unknown as new () => TPanelHarness)()
        panel.open = false
        panel.$emit = vi.fn()
        panel.mounted()

        const modal = new (UiModal as unknown as new (idService: IdService) => TModalHarness)(new IdService())
        modal.open = false
        modal.loading = false
        modal.$emit = vi.fn()
        modal.mounted()

        panel.open = true
        panel.openChanged(true)
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        modal.open = true
        modal.openChanged(true)
        expect(ModalEscapeStack.hasOpenModal()).toBe(true)

        modal.loading = true
        dispatchEscape()
        expect(modal.$emit).not.toHaveBeenCalled()
        expect(panel.$emit).not.toHaveBeenCalled()

        modal.loading = false
        dispatchEscape()
        expect(modal.$emit).toHaveBeenCalledTimes(1)
        expect(modal.$emit).toHaveBeenCalledWith('close')
        expect(panel.$emit).not.toHaveBeenCalled()

        modal.open = false
        modal.openChanged(false)
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        dispatchEscape()
        expect(panel.$emit).toHaveBeenCalledTimes(1)
        expect(panel.$emit).toHaveBeenCalledWith('close')

        modal.beforeUnmount()
        panel.beforeUnmount()
    })

    it('closes ConfirmDialog over UiSidePanel without closing the side panel', () => {
        type TPanelHarness = {
            open: boolean
            $emit: ReturnType<typeof vi.fn>
            mounted: () => void
            beforeUnmount: () => void
            openChanged: (open: boolean) => void
        }
        type TConfirmHarness = TPanelHarness & {
            loading: boolean
        }

        const panel = new (UiSidePanel as unknown as new () => TPanelHarness)()
        panel.open = true
        panel.$emit = vi.fn()
        panel.mounted()

        const confirm = new (ConfirmDialog as unknown as new (idService: IdService) => TConfirmHarness)(new IdService())
        confirm.open = true
        confirm.loading = false
        confirm.$emit = vi.fn()
        confirm.mounted()

        expect(ModalEscapeStack.hasOpenModal()).toBe(true)

        dispatchEscape()
        expect(confirm.$emit).toHaveBeenCalledTimes(1)
        expect(confirm.$emit).toHaveBeenCalledWith('cancel')
        expect(panel.$emit).not.toHaveBeenCalled()

        confirm.beforeUnmount()
        expect(ModalEscapeStack.hasOpenModal()).toBe(false)

        dispatchEscape()
        expect(panel.$emit).toHaveBeenCalledTimes(1)
        expect(panel.$emit).toHaveBeenCalledWith('close')

        panel.beforeUnmount()
    })
})

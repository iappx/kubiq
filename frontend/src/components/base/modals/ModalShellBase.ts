import { VueBase } from '@iappx/vue-facing-di'
import { nextTick } from 'vue'
import { ModalEscapeStack } from '@/components/base/modals/ModalEscapeStack'
import type { TModalLayer } from '@/components/base/modals/types/TModalLayer'

export abstract class ModalShellBase extends VueBase {
    private restoreFocusTo: HTMLElement | null = null

    private escapeToken: symbol | null = null

    protected abstract isOpen(): boolean

    protected abstract onEscape(): void

    protected escapeLayer(): TModalLayer {
        return 'modal'
    }

    mounted(): void {
        if (this.isOpen()) {
            this.registerEscape()
        }
    }

    beforeUnmount(): void {
        this.unregisterEscape()
        this.releaseFocus()
    }

    protected async handleOpenChange(open: boolean): Promise<void> {
        if (!open) {
            this.unregisterEscape()
            this.releaseFocus()
            return
        }

        this.registerEscape()
        this.restoreFocusTo = document.activeElement as HTMLElement | null
        await nextTick()
        if (this.isOpen()) {
            this.focusPanel()
        }
    }

    private registerEscape(): void {
        if (!this.escapeToken) {
            this.escapeToken = Symbol('modal-shell')
        }

        ModalEscapeStack.push(this.escapeToken, this.escapeLayer(), () => {
            if (this.isOpen()) {
                this.onEscape()
            }
        })
    }

    private unregisterEscape(): void {
        if (!this.escapeToken) {
            return
        }

        ModalEscapeStack.remove(this.escapeToken)
    }

    private focusPanel(): void {
        const panel = this.$refs.panel as HTMLElement | undefined
        const target = panel?.querySelector<HTMLElement>('[autofocus], input, textarea, button')
        target?.focus()
    }

    private releaseFocus(): void {
        this.restoreFocusTo?.focus()
        this.restoreFocusTo = null
    }
}

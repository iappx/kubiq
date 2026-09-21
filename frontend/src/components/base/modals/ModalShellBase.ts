import { VueBase } from '@iappx/vue-facing-di'
import { nextTick } from 'vue'

export abstract class ModalShellBase extends VueBase {
    private restoreFocusTo: HTMLElement | null = null

    private escapeHandler!: (event: KeyboardEvent) => void

    protected abstract isOpen(): boolean

    protected abstract onEscape(): void

    mounted(): void {
        // Not a field initialiser: that runs on the raw class instance, so the listener would capture a stale `this`.
        this.escapeHandler = event => {
            if (event.key === 'Escape' && this.isOpen()) {
                this.onEscape()
            }
        }

        document.addEventListener('keydown', this.escapeHandler)
    }

    beforeUnmount(): void {
        document.removeEventListener('keydown', this.escapeHandler)
        this.releaseFocus()
    }

    protected async handleOpenChange(open: boolean): Promise<void> {
        if (!open) {
            this.releaseFocus()
            return
        }

        this.restoreFocusTo = document.activeElement as HTMLElement | null
        await nextTick()
        this.focusPanel()
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

import { VueBase } from '@iappx/vue-facing-di'
import { nextTick } from 'vue'

// Subclasses render the markup, expose a `panel` ref and call handleOpenChange
// from a @Watch on their own open prop.
export abstract class ModalShellBase extends VueBase {
    private restoreFocusTo: HTMLElement | null = null

    private escapeHandler!: (event: KeyboardEvent) => void

    protected abstract isOpen(): boolean

    protected abstract onEscape(): void

    mounted(): void {
        // Built here rather than as a field initialiser: an initialiser runs on
        // the raw class instance, the hook on the reactive proxy — a listener
        // that captured the raw `this` reads stale state and never fires.
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

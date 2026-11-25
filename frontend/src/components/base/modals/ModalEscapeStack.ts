import type { TModalLayer } from '@/components/base/modals/types/TModalLayer'

export class ModalEscapeStack {
    private static entries: Array<{
        owner: object | symbol
        layer: TModalLayer
        onEscape: () => void
    }> = []

    private static attached = false

    public static push(owner: object | symbol, layer: TModalLayer, onEscape: () => void): void {
        ModalEscapeStack.entries = [
            ...ModalEscapeStack.entries.filter(entry => entry.owner !== owner),
            { owner, layer, onEscape },
        ]
        ModalEscapeStack.syncListener()
    }

    public static remove(owner: object | symbol): void {
        const next = ModalEscapeStack.entries.filter(entry => entry.owner !== owner)
        if (next.length === ModalEscapeStack.entries.length) {
            return
        }
        ModalEscapeStack.entries = next
        ModalEscapeStack.syncListener()
    }

    public static isTop(owner: object | symbol): boolean {
        return ModalEscapeStack.top()?.owner === owner
    }

    public static hasOpenModal(): boolean {
        return ModalEscapeStack.entries.some(entry => entry.layer === 'modal')
    }

    public static clear(): void {
        ModalEscapeStack.entries = []
        ModalEscapeStack.syncListener()
    }

    private static top(): { owner: object | symbol; layer: TModalLayer; onEscape: () => void } | undefined {
        for (let i = ModalEscapeStack.entries.length - 1; i >= 0; i--) {
            if (ModalEscapeStack.entries[i].layer === 'modal') {
                return ModalEscapeStack.entries[i]
            }
        }

        return ModalEscapeStack.entries[ModalEscapeStack.entries.length - 1]
    }

    private static syncListener(): void {
        if (typeof document === 'undefined') {
            return
        }

        if (ModalEscapeStack.entries.length > 0 && !ModalEscapeStack.attached) {
            document.addEventListener('keydown', ModalEscapeStack.onKeydown)
            ModalEscapeStack.attached = true
            return
        }

        if (ModalEscapeStack.entries.length === 0 && ModalEscapeStack.attached) {
            document.removeEventListener('keydown', ModalEscapeStack.onKeydown)
            ModalEscapeStack.attached = false
        }
    }

    private static onKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || event.defaultPrevented) {
            return
        }

        const top = ModalEscapeStack.top()
        if (!top) {
            return
        }

        event.preventDefault()
        event.stopPropagation()
        top.onEscape()
    }
}

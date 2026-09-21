import type { TShellCommand } from '@/components/clusterShell/types/TShellCommand'
import type { TShellEscapeTarget } from '@/components/clusterShell/types/TShellEscapeTarget'

export class ShellKeymap {
    public static readonly paletteKey: string = 'k'

    public static readonly sidebarKey: string = '\\'

    public static readonly escapeKey: string = 'Escape'

    public static command(event: KeyboardEvent, isTyping: boolean): TShellCommand | null {
        if (event.key === ShellKeymap.escapeKey) {
            // A field owns its own Escape: the filter clears instead of the panel closing.
            return isTyping ? null : 'escape'
        }

        if (!ShellKeymap.hasCommandModifier(event) || event.altKey) {
            return null
        }

        if (event.key.toLowerCase() === ShellKeymap.paletteKey) {
            return 'palette'
        }

        return event.key === ShellKeymap.sidebarKey ? 'sidebar' : null
    }

    // 'cursor' declines the event rather than handling it: the table owns the row cursor.
    public static escapeTarget(state: { panelOpen: boolean; dockOpen: boolean }): TShellEscapeTarget {
        if (state.panelOpen) {
            return 'panel'
        }

        return state.dockOpen ? 'dock' : 'cursor'
    }

    private static hasCommandModifier(event: KeyboardEvent): boolean {
        return event.ctrlKey || event.metaKey
    }
}

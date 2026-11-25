import type { TTerminalMode } from '@/domain/models/settings/types/TTerminalMode'

export class TerminalModeCatalog {
    public static readonly Default: TTerminalMode = 'in-app'

    public static readonly values: Record<TTerminalMode, string> = {
        'in-app': 'In-app terminal',
        system: 'System terminal',
        custom: 'Custom terminal',
    }

    public static readonly descriptions: Record<TTerminalMode, string> = {
        'in-app': "Open local shells inside kubiq's bottom dock.",
        system: "Detect and launch your operating system's terminal with KUBECONFIG set.",
        custom: 'Launch a terminal application or executable of your choice.',
    }

    public static get modes(): TTerminalMode[] {
        return Object.keys(TerminalModeCatalog.values) as TTerminalMode[]
    }

    public static title(mode: TTerminalMode): string {
        return TerminalModeCatalog.values[mode] ?? mode
    }

    public static description(mode: TTerminalMode): string {
        return TerminalModeCatalog.descriptions[mode] ?? ''
    }

    public static has(mode: string): mode is TTerminalMode {
        return Object.prototype.hasOwnProperty.call(TerminalModeCatalog.values, mode)
    }

    public static parse(raw: unknown): TTerminalMode {
        return typeof raw === 'string' && TerminalModeCatalog.has(raw)
            ? raw
            : TerminalModeCatalog.Default
    }

    public static isExternal(mode: TTerminalMode): boolean {
        return mode !== 'in-app'
    }
}

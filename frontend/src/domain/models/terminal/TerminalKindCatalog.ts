import type { TTerminalKind } from '@/domain/models/terminal/types/TTerminalKind'

export class TerminalKindCatalog {
    private static readonly titles: Record<TTerminalKind, string> = {
        exec: 'Container shell',
        local: 'Local shell',
        node: 'Node shell',
    }

    public static all(): TTerminalKind[] {
        return Object.keys(TerminalKindCatalog.titles) as TTerminalKind[]
    }

    public static has(value: string): value is TTerminalKind {
        return value in TerminalKindCatalog.titles
    }

    public static title(kind: TTerminalKind): string {
        return TerminalKindCatalog.titles[kind]
    }

    public static parse(value: unknown): TTerminalKind {
        return typeof value === 'string' && TerminalKindCatalog.has(value) ? value : 'local'
    }
}

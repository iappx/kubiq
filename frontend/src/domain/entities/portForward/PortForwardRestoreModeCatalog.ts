import type { TPortForwardRestoreMode } from '@/domain/entities/portForward/types/TPortForwardRestoreMode'

export class PortForwardRestoreModeCatalog {
    public static readonly defaultMode: TPortForwardRestoreMode = 'onConnect'

    public static readonly values: Record<TPortForwardRestoreMode, string> = {
        manual: 'Manual',
        onConnect: 'On connect',
        connectOnStart: 'Connect on start',
    }

    public static readonly descriptions: Record<TPortForwardRestoreMode, string> = {
        manual: 'Stays stopped until you start it',
        onConnect: 'Starts whenever the cluster is connected',
        connectOnStart: 'Connects the cluster when kubiq starts, then starts',
    }

    public static get modes(): TPortForwardRestoreMode[] {
        return Object.keys(PortForwardRestoreModeCatalog.values) as TPortForwardRestoreMode[]
    }

    public static title(mode: TPortForwardRestoreMode): string {
        return PortForwardRestoreModeCatalog.values[mode] ?? mode
    }

    public static description(mode: TPortForwardRestoreMode): string {
        return PortForwardRestoreModeCatalog.descriptions[mode] ?? ''
    }

    public static has(mode: string): mode is TPortForwardRestoreMode {
        return Object.prototype.hasOwnProperty.call(PortForwardRestoreModeCatalog.values, mode)
    }

    public static of(mode: string | undefined): TPortForwardRestoreMode {
        return mode !== undefined && PortForwardRestoreModeCatalog.has(mode)
            ? mode
            : PortForwardRestoreModeCatalog.defaultMode
    }

    public static restoresOnConnect(mode: TPortForwardRestoreMode): boolean {
        return mode !== 'manual'
    }

    public static connectsOnStart(mode: TPortForwardRestoreMode): boolean {
        return mode === 'connectOnStart'
    }
}

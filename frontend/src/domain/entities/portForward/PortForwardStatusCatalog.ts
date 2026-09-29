import type { TPortForwardStatus } from '@/domain/entities/portForward/types/TPortForwardStatus'

export class PortForwardStatusCatalog {
    public static readonly values: Record<TPortForwardStatus, string> = {
        starting: 'Starting',
        active: 'Active',
        stopped: 'Stopped',
        waiting: 'Waiting for cluster',
        reconnecting: 'Reconnecting',
        error: 'Error',
    }

    public static title(status: TPortForwardStatus): string {
        return PortForwardStatusCatalog.values[status] ?? status
    }

    public static has(status: string): boolean {
        return Object.prototype.hasOwnProperty.call(PortForwardStatusCatalog.values, status)
    }

    public static isListening(status: TPortForwardStatus): boolean {
        return status === 'active' || status === 'reconnecting'
    }

    public static isRunning(status: TPortForwardStatus): boolean {
        return status === 'starting' || PortForwardStatusCatalog.isListening(status)
    }

    public static isProblematic(status: TPortForwardStatus): boolean {
        return status === 'error' || status === 'reconnecting'
    }
}

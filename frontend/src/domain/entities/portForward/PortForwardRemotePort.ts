import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class PortForwardRemotePort {
    public static readonly maxPort: number = 65535

    public static of(value: TPortForwardRemotePort | null | undefined): TPortForwardRemotePort {
        if (typeof value === 'number') {
            return value
        }

        const text = (value ?? '').trim()

        return /^\d+$/.test(text) ? Number(text) : text
    }

    public static numberOf(value: TPortForwardRemotePort): number {
        const port = PortForwardRemotePort.of(value)

        return typeof port === 'number' && PortForwardRemotePort.inRange(port) ? port : 0
    }

    public static isNamed(value: TPortForwardRemotePort): boolean {
        return typeof PortForwardRemotePort.of(value) === 'string'
    }

    public static same(left: TPortForwardRemotePort, right: TPortForwardRemotePort): boolean {
        return String(PortForwardRemotePort.of(left)) === String(PortForwardRemotePort.of(right))
    }

    public static inRange(port: number): boolean {
        return Number.isInteger(port) && port > 0 && port <= PortForwardRemotePort.maxPort
    }
}

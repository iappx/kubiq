import type { TUiComboOption } from '@/components/common/form/types/TUiComboOption'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class PortForwardPortOptions {
    public static readonly forwardableProtocol: string = 'TCP'

    public static readonly minUnprivilegedPort: number = 1024

    public static readonly maxPort: number = 65535

    public static readonly customChoice: string = '__custom__'

    private static readonly whole: RegExp = /^\d+$/

    public static of(ports: readonly TPortForwardPort[]): TUiComboOption[] {
        return ports.map(port => ({
            value: String(port.port),
            title: String(port.port),
            detail: PortForwardPortOptions.detailOf(port),
            disabled: !PortForwardPortOptions.isForwardable(port),
        }))
    }

    public static initial(ports: readonly TPortForwardPort[], preset: TPortForwardRemotePort): string {
        const wanted = PortForwardRemotePort.of(preset)
        if (wanted !== '' && wanted !== 0) {
            return String(wanted)
        }

        const only = ports.length === 1 ? ports[0] : undefined

        return only && PortForwardPortOptions.isForwardable(only) ? String(only.port) : ''
    }

    public static isForwardable(port: TPortForwardPort): boolean {
        return port.protocol.toUpperCase() === PortForwardPortOptions.forwardableProtocol
    }

    public static labelOf(port: TPortForwardPort): string {
        return port.name !== '' ? `${port.name} · ${port.port}` : String(port.port)
    }

    public static matchingValue(ports: readonly TPortForwardPort[], remotePort: string): string {
        const trimmed = remotePort.trim()
        if (trimmed === '') {
            return ''
        }

        const matched = ports.find(port => PortForwardPortOptions.isForwardable(port)
            && (String(port.port) === trimmed || (port.name !== '' && port.name === trimmed)))

        return matched ? String(matched.port) : ''
    }

    public static suggestedLocalPort(remotePort: string): string {
        const parsed = PortForwardPortOptions.parseLocalPort(remotePort)
        if (parsed === null || parsed < PortForwardPortOptions.minUnprivilegedPort) {
            return ''
        }

        return String(parsed)
    }

    public static parseLocalPort(value: string): number | null {
        const trimmed = value.trim()
        if (!PortForwardPortOptions.whole.test(trimmed)) {
            return null
        }

        const parsed = Number.parseInt(trimmed, 10)
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > PortForwardPortOptions.maxPort) {
            return null
        }

        return parsed
    }

    private static detailOf(port: TPortForwardPort): string {
        const detail = [port.name, port.container ?? '', port.protocol].filter(part => part !== '').join(' · ')

        return PortForwardPortOptions.isForwardable(port) ? detail : `${detail}, cannot be forwarded`
    }
}

import type { TUiComboOption } from '@/components/common/form/types/TUiComboOption'
import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class PortForwardPortOptions {
    public static readonly forwardableProtocol: string = 'TCP'

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

    private static detailOf(port: TPortForwardPort): string {
        const detail = [port.name, port.protocol].filter(part => part !== '').join(' · ')

        return PortForwardPortOptions.isForwardable(port) ? detail : `${detail}, cannot be forwarded`
    }
}

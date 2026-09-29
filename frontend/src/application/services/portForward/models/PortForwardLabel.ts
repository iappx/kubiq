import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class PortForwardLabel {
    public static readonly pods: string = 'pods'

    public static readonly services: string = 'services'

    public static of(resource: string, name: string, remotePort: TPortForwardRemotePort): string {
        return `${PortForwardLabel.shortName(resource)}/${name}:${remotePort}`
    }

    public static shortName(resource: string): string {
        return resource === PortForwardLabel.services ? 'svc' : 'pod'
    }
}

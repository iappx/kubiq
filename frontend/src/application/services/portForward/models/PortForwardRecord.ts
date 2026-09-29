import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardChange } from '@/application/services/portForward/types/TPortForwardChange'
import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'
import type { PortForwardEntity } from '@/domain/entities/portForward/PortForwardEntity'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import { PortForwardRestoreModeCatalog } from '@/domain/entities/portForward/PortForwardRestoreModeCatalog'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'
import type { TPortForwardRestoreMode } from '@/domain/entities/portForward/types/TPortForwardRestoreMode'
import type { TPortForwardStatus } from '@/domain/entities/portForward/types/TPortForwardStatus'

export class PortForwardRecord {
    public static readonly loopback: string = '127.0.0.1'

    public static of(entity: PortForwardEntity, runtime: TPortForwardRuntime): TPortForward {
        const remotePort = PortForwardRemotePort.of(entity.remotePort)

        return {
            id: entity.id,
            clusterId: entity.clusterId ?? '',
            namespace: entity.namespace ?? '',
            resource: entity.resource === 'services' ? 'services' : 'pods',
            name: entity.name ?? '',
            remotePort,
            localPort: entity.localPort ?? 0,
            lastLocalPort: entity.lastLocalPort ?? 0,
            restoreMode: PortForwardRestoreModeCatalog.of(entity.restoreMode),
            isStoppedByUser: entity.isStoppedByUser === true,
            createdAt: entity.createdAt ?? 0,
            label: PortForwardLabel.of(entity.resource, entity.name ?? '', remotePort),
            ...runtime,
        }
    }

    public static idle(status: TPortForwardStatus, error: string = ''): TPortForwardRuntime {
        return { status, error, boundPort: 0, podName: '', targetPort: 0 }
    }

    public static runtimeOf(forward: TPortForward): TPortForwardRuntime {
        return {
            status: forward.status,
            error: forward.error,
            boundPort: forward.boundPort,
            podName: forward.podName,
            targetPort: forward.targetPort,
        }
    }

    public static restingStatus(mode: TPortForwardRestoreMode, isStoppedByUser: boolean): TPortForwardStatus {
        return !isStoppedByUser && PortForwardRestoreModeCatalog.restoresOnConnect(mode) ? 'waiting' : 'stopped'
    }

    public static portOf(forward: TPortForward): number {
        return forward.boundPort || forward.localPort || forward.lastLocalPort
    }

    public static addressOf(forward: TPortForward): string {
        const port = PortForwardRecord.portOf(forward)

        return port > 0 ? `${PortForwardRecord.loopback}:${port}` : ''
    }

    public static urlOf(forward: TPortForward): string {
        const address = PortForwardRecord.addressOf(forward)

        return address === '' ? '' : `http://${address}`
    }

    public static matches(
        forward: TPortForward,
        clusterId: string,
        namespace: string,
        resource: string,
        name: string,
        remotePort: TPortForwardRemotePort,
    ): boolean {
        return forward.clusterId === clusterId
            && forward.namespace === namespace
            && forward.resource === resource
            && forward.name === name
            && PortForwardRemotePort.same(forward.remotePort, remotePort)
    }

    public static changesPorts(forward: TPortForward, change: TPortForwardChange): boolean {
        const remoteChanged = change.remotePort !== undefined
            && !PortForwardRemotePort.same(forward.remotePort, change.remotePort)
        const localChanged = change.localPort !== undefined && change.localPort !== forward.localPort

        return remoteChanged || localChanged
    }
}

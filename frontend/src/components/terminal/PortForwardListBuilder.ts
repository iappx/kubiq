import { PortForwardLabel } from '@/application/services/portForward/models/PortForwardLabel'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { ClusterRoutes } from '@/components/clusterShell/ClusterRoutes'
import { PortForwardTone } from '@/components/terminal/PortForwardTone'
import type { TPortForwardGroup } from '@/components/terminal/types/TPortForwardGroup'
import type { TPortForwardRow } from '@/components/terminal/types/TPortForwardRow'
import { PortForwardRestoreModeCatalog, PortForwardStatusCatalog } from '@/domain/entities/portForward'
import { KubeResourceRegistry } from '@/domain/models/kube'

export class PortForwardListBuilder {
    public static groups(forwards: readonly TPortForward[]): TPortForwardGroup[] {
        const byCluster = new Map<string, TPortForward[]>()
        forwards.forEach((forward) => {
            byCluster.set(forward.clusterId, [...(byCluster.get(forward.clusterId) ?? []), forward])
        })

        return [...byCluster.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([clusterId, members]) => ({
                clusterId,
                title: clusterId,
                rows: [...members]
                    .sort((left, right) => PortForwardListBuilder.compare(left, right))
                    .map(forward => PortForwardListBuilder.row(forward)),
            }))
    }

    public static row(forward: TPortForward): TPortForwardRow {
        const address = PortForwardRecord.addressOf(forward)
        const isListening = PortForwardStatusCatalog.isListening(forward.status)

        return {
            id: forward.id,
            clusterId: forward.clusterId,
            target: PortForwardListBuilder.targetOf(forward),
            address,
            path: PortForwardListBuilder.pathOf(forward),
            tone: PortForwardTone.of(forward.status),
            statusTitle: PortForwardStatusCatalog.title(forward.status),
            modeTitle: PortForwardRestoreModeCatalog.title(forward.restoreMode),
            modeHint: PortForwardRestoreModeCatalog.description(forward.restoreMode),
            error: forward.status === 'error' || forward.status === 'reconnecting' ? forward.error : '',
            isListening,
            canOpen: isListening && address !== '',
            canCopy: address !== '',
            canStop: PortForwardStatusCatalog.isRunning(forward.status) || forward.status === 'waiting',
        }
    }

    public static targetOf(forward: TPortForward): string {
        return `${forward.namespace} / ${PortForwardLabel.shortName(forward.resource)} / ${forward.name}:${forward.remotePort}`
    }

    public static pathOf(forward: TPortForward): string {
        const kind = KubeResourceRegistry.find('', forward.resource)

        return kind
            ? ClusterRoutes.object(forward.clusterId, kind, { namespace: forward.namespace, name: forward.name })
            : ''
    }

    public static summary(forwards: readonly TPortForward[]): string {
        const active = forwards.filter(forward => PortForwardStatusCatalog.isListening(forward.status)).length
        const troubled = forwards.filter(forward => PortForwardStatusCatalog.isProblematic(forward.status)).length
        const counts = `${active} of ${forwards.length} active`

        return troubled === 0 ? counts : `${counts}, ${troubled} need${troubled === 1 ? 's' : ''} attention`
    }

    private static compare(left: TPortForward, right: TPortForward): number {
        return left.namespace.localeCompare(right.namespace)
            || left.name.localeCompare(right.name)
            || left.resource.localeCompare(right.resource)
            || String(left.remotePort).localeCompare(String(right.remotePort), undefined, { numeric: true })
    }
}

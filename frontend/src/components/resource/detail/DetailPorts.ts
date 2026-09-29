import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TDetailPort } from '@/components/resource/detail/types/TDetailPort'
import { PortForwardPortOptions } from '@/components/terminal/PortForwardPortOptions'
import { PortForwardTarget } from '@/application/services/portForward/models/PortForwardTarget'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardStatus } from '@/domain/entities/portForward'
import { PodSpecReader } from '@/domain/entities/workloads'
import type { TKubeContainer, TKubeContainerPort } from '@/domain/entities/workloads'
import type { TServicePort } from '@/domain/entities/network'
import { KubeManifest, KubeWorkloadCatalog } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class DetailPorts {
    public static readonly tones: Record<TPortForwardStatus, TUiTone> = {
        starting: 'pending',
        active: 'ok',
        stopped: 'unknown',
        waiting: 'pending',
        reconnecting: 'warning',
        error: 'error',
    }

    public static isShown(kind: KubeResourceKind): boolean {
        return KubeWorkloadCatalog.canForwardPort(kind)
    }

    public static of(object: Record<string, unknown>, kind: KubeResourceKind): TDetailPort[] {
        if (!DetailPorts.isShown(kind)) {
            return []
        }

        return KubeWorkloadCatalog.isPod(kind) ? DetailPorts.ofPod(object) : DetailPorts.ofService(object)
    }

    public static ofPod(object: Record<string, unknown>): TDetailPort[] {
        const spec = PodSpecReader.of(object)
        const rows = [...DetailPorts.list<TKubeContainer>(spec.initContainers), ...DetailPorts.list<TKubeContainer>(spec.containers)]
            .flatMap(container => DetailPorts.list<TKubeContainerPort>(container.ports)
                .filter(port => DetailPorts.isPort(port.containerPort))
                .map(port => DetailPorts.row(port.containerPort as number, port.name, port.protocol, {
                    container: DetailPorts.text(container.name),
                })))

        return DetailPorts.unique(rows)
    }

    public static ofService(object: Record<string, unknown>): TDetailPort[] {
        const spec = KubeManifest.isObject(object.spec) ? object.spec : {}
        const rows = DetailPorts.list<TServicePort>(spec.ports)
            .filter(port => DetailPorts.isPort(port.port))
            .map(port => DetailPorts.row(port.port, port.name, port.protocol, {
                targetPort: DetailPorts.text(port.targetPort) || String(port.port),
                nodePort: DetailPorts.isPort(port.nodePort) ? port.nodePort as number : 0,
            }))

        return DetailPorts.unique(rows)
    }

    public static toneOf(status: TPortForwardStatus): TUiTone {
        return DetailPorts.tones[status] ?? 'unknown'
    }

    public static via(forwards: readonly TPortForward[], port: TDetailPort): TPortForward[] {
        return forwards.filter(forward => forward.targetPort === port.port)
    }

    public static unmatched(forwards: readonly TPortForward[], ports: readonly TDetailPort[]): TPortForward[] {
        return forwards.filter(forward => !ports.some(port => port.port === forward.targetPort))
    }

    private static row(
        port: number,
        name: string | undefined,
        protocol: string | undefined,
        extra: Partial<Pick<TDetailPort, 'container' | 'targetPort' | 'nodePort'>>,
    ): TDetailPort {
        const container = extra.container ?? ''
        const declared = {
            port,
            name: DetailPorts.text(name),
            protocol: DetailPorts.text(protocol).toUpperCase() || PortForwardTarget.defaultProtocol,
        }

        return {
            ...declared,
            key: [container, port, declared.protocol].join('/'),
            forwardable: PortForwardPortOptions.isForwardable(declared),
            container,
            targetPort: extra.targetPort ?? '',
            nodePort: extra.nodePort ?? 0,
        }
    }

    private static unique(rows: TDetailPort[]): TDetailPort[] {
        return rows.filter((row, index) => rows.findIndex(other => other.key === row.key) === index)
    }

    private static isPort(value: unknown): boolean {
        return typeof value === 'number' && Number.isInteger(value) && value > 0
    }

    private static list<T>(value: unknown): T[] {
        return Array.isArray(value) ? value.filter(entry => KubeManifest.isObject(entry)) as T[] : []
    }

    private static text(value: unknown): string {
        if (typeof value === 'number') {
            return String(value)
        }

        return typeof value === 'string' ? value : ''
    }
}

import type { TPortForwardPort } from '@/application/services/portForward/types/TPortForwardPort'
import type { PodEntity, TKubeContainerPort } from '@/domain/entities/workloads'
import type { ServiceEntity, TServicePort } from '@/domain/entities/network'
import { PortForwardRemotePort } from '@/domain/entities/portForward/PortForwardRemotePort'
import type { TPortForwardRemotePort } from '@/domain/entities/portForward/types/TPortForwardRemotePort'

export class PortForwardTarget {
    public static readonly defaultProtocol: string = 'TCP'

    public static servicePort(service: ServiceEntity, remotePort: TPortForwardRemotePort): TServicePort | undefined {
        const wanted = PortForwardRemotePort.of(remotePort)

        return (service.spec?.ports ?? []).find(port => (typeof wanted === 'number'
            ? port.port === wanted
            : (port.name ?? '') === wanted))
    }

    public static selectorOf(service: ServiceEntity): string {
        const selector = service.spec?.selector ?? {}

        return Object.keys(selector).map(key => `${key}=${selector[key]}`).join(',')
    }

    public static containerPort(pod: PodEntity, remotePort: TPortForwardRemotePort): number {
        const wanted = PortForwardRemotePort.of(remotePort)
        if (typeof wanted === 'number') {
            return PortForwardRemotePort.inRange(wanted) ? wanted : 0
        }

        const named = PortForwardTarget.declaredPorts(pod).find(port => port.name === wanted)

        return named?.containerPort ?? 0
    }

    public static targetPortOf(pod: PodEntity, port: TServicePort): number {
        const target = port.targetPort
        if (target === undefined || target === '') {
            return port.port
        }

        return PortForwardTarget.containerPort(pod, target) || port.port
    }

    public static isServing(pod: PodEntity): boolean {
        return !pod.metadata?.isDeleting && pod.phase === 'Running'
    }

    public static podPorts(pod: PodEntity): TPortForwardPort[] {
        const ports = PortForwardTarget.declaredPorts(pod)
            .filter(port => typeof port.containerPort === 'number' && port.containerPort > 0)
            .map(port => PortForwardTarget.portOf(port.containerPort as number, port.name, port.protocol))

        return ports.filter((port, index) => ports.findIndex(other => PortForwardTarget.sameDeclaration(port, other)) === index)
    }

    public static servicePorts(service: ServiceEntity): TPortForwardPort[] {
        return (service.spec?.ports ?? [])
            .filter(port => typeof port.port === 'number' && port.port > 0)
            .map(port => PortForwardTarget.portOf(port.port, port.name, port.protocol))
    }

    private static portOf(port: number, name: string | undefined, protocol: string | undefined): TPortForwardPort {
        return { port, name: name ?? '', protocol: protocol || PortForwardTarget.defaultProtocol }
    }

    private static sameDeclaration(left: TPortForwardPort, right: TPortForwardPort): boolean {
        return left.port === right.port && left.name === right.name && left.protocol === right.protocol
    }

    private static declaredPorts(pod: PodEntity): TKubeContainerPort[] {
        return [...(pod.spec?.initContainers ?? []), ...(pod.spec?.containers ?? [])]
            .flatMap(container => container.ports ?? [])
    }
}

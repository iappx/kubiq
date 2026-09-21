import type { PodEntity } from '@/domain/entities/workloads'
import type { ServiceEntity, TServicePort } from '@/domain/entities/network'

export class PortForwardTarget {
    public static servicePort(service: ServiceEntity, remotePort: number): TServicePort | undefined {
        const ports = service.spec?.ports ?? []

        return ports.find(port => port.port === remotePort) ?? ports[0]
    }

    public static selectorOf(service: ServiceEntity): string {
        const selector = service.spec?.selector ?? {}

        return Object.keys(selector).map(key => `${key}=${selector[key]}`).join(',')
    }

    public static containerPort(pod: PodEntity, targetPort: string | number | undefined, fallback: number): number {
        if (typeof targetPort === 'number') {
            return targetPort
        }
        if (targetPort === undefined || targetPort === '') {
            return fallback
        }

        const numeric = Number(targetPort)
        if (Number.isInteger(numeric) && numeric > 0) {
            return numeric
        }

        const named = (pod.spec?.containers ?? [])
            .flatMap(container => container.ports ?? [])
            .find(port => port.name === targetPort)

        return named?.containerPort ?? fallback
    }

    public static podPorts(pod: PodEntity): { port: number, name: string }[] {
        return [...(pod.spec?.initContainers ?? []), ...(pod.spec?.containers ?? [])]
            .flatMap(container => container.ports ?? [])
            .filter(port => typeof port.containerPort === 'number' && port.containerPort > 0)
            .map(port => ({ port: port.containerPort as number, name: port.name ?? '' }))
    }

    public static servicePorts(service: ServiceEntity): { port: number, name: string }[] {
        return (service.spec?.ports ?? [])
            .filter(port => typeof port.port === 'number' && port.port > 0)
            .map(port => ({ port: port.port, name: port.name ?? '' }))
    }
}

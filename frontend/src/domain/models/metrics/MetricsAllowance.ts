import { MetricQuantity } from '@/domain/models/metrics/MetricQuantity'
import type { TMetricsAllowance } from '@/domain/models/metrics/types/TMetricsAllowance'

export class MetricsAllowance {
    public static empty(): TMetricsAllowance {
        return { cpu: { request: 0, limit: 0 }, memory: { request: 0, limit: 0 } }
    }

    public static ofPod(object: Record<string, unknown>): TMetricsAllowance {
        const containers = MetricsAllowance.containers(object)
        const allowance = MetricsAllowance.empty()

        containers.forEach((container) => {
            const resources = MetricsAllowance.record(container.resources)
            const requests = MetricsAllowance.record(resources?.requests)
            const limits = MetricsAllowance.record(resources?.limits)

            allowance.cpu.request += MetricQuantity.parse(requests?.cpu)
            allowance.cpu.limit += MetricQuantity.parse(limits?.cpu)
            allowance.memory.request += MetricQuantity.parse(requests?.memory)
            allowance.memory.limit += MetricQuantity.parse(limits?.memory)
        })

        return allowance
    }

    // A node has no requests of its own: the softer figure is what the scheduler may
    // hand out, the harder one is what the machine physically has.
    public static ofNode(object: Record<string, unknown>): TMetricsAllowance {
        const status = MetricsAllowance.record(object.status)
        const allocatable = MetricsAllowance.record(status?.allocatable)
        const capacity = MetricsAllowance.record(status?.capacity)

        return {
            cpu: {
                request: MetricQuantity.parse(allocatable?.cpu),
                limit: MetricQuantity.parse(capacity?.cpu),
            },
            memory: {
                request: MetricQuantity.parse(allocatable?.memory),
                limit: MetricQuantity.parse(capacity?.memory),
            },
        }
    }

    // Init containers are left out on purpose: Kubernetes takes the larger of their
    // request and the sum of the regular ones, so adding them would overstate the pod.
    private static containers(object: Record<string, unknown>): Record<string, unknown>[] {
        const declared = MetricsAllowance.record(object.spec)?.containers

        return Array.isArray(declared) ? declared as Record<string, unknown>[] : []
    }

    private static record(value: unknown): Record<string, unknown> | undefined {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : undefined
    }
}

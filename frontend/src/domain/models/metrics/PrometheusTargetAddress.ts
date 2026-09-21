import type { TPrometheusTarget } from '@/domain/models/metrics/types/TPrometheusTarget'

export class PrometheusTargetAddress {
    private static readonly pattern: RegExp = /^([^/\s]+)\/([^:\s]+):([^:\s]+)$/

    public static parse(address: unknown): TPrometheusTarget | null {
        if (typeof address !== 'string') {
            return null
        }

        const match = PrometheusTargetAddress.pattern.exec(address.trim())
        if (!match) {
            return null
        }

        return { namespace: match[1], service: match[2], port: match[3] }
    }

    public static format(target: TPrometheusTarget): string {
        return `${target.namespace}/${target.service}:${target.port}`
    }
}

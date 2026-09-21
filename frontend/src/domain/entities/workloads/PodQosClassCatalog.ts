import type { TPodQosClass } from '@/domain/entities/workloads/types/TPodQosClass'

export class PodQosClassCatalog {
    public static readonly values: Record<TPodQosClass, string> = {
        Guaranteed: 'Guaranteed',
        Burstable: 'Burstable',
        BestEffort: 'Best effort',
    }

    public static title(qosClass: TPodQosClass): string {
        return PodQosClassCatalog.values[qosClass] ?? qosClass
    }

    public static has(qosClass: string): boolean {
        return Object.prototype.hasOwnProperty.call(PodQosClassCatalog.values, qosClass)
    }
}

import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export class KubeConditions {
    public static find(conditions: TKubeCondition[] | undefined, type: string): TKubeCondition | undefined {
        return (conditions ?? []).find(p => p.type === type)
    }

    public static isTrue(conditions: TKubeCondition[] | undefined, type: string): boolean {
        return KubeConditions.find(conditions, type)?.status === 'True'
    }

    public static isFalse(conditions: TKubeCondition[] | undefined, type: string): boolean {
        return KubeConditions.find(conditions, type)?.status === 'False'
    }

    public static reason(conditions: TKubeCondition[] | undefined, type: string): string | undefined {
        return KubeConditions.find(conditions, type)?.reason
    }
}

import type { TCronJobConcurrencyPolicy } from '@/domain/entities/workloads/types/TCronJobConcurrencyPolicy'

export class CronJobConcurrencyPolicyCatalog {
    public static readonly values: Record<TCronJobConcurrencyPolicy, string> = {
        Allow: 'Allow concurrent',
        Forbid: 'Forbid concurrent',
        Replace: 'Replace previous',
    }

    public static title(policy: TCronJobConcurrencyPolicy): string {
        return CronJobConcurrencyPolicyCatalog.values[policy] ?? policy
    }

    public static has(policy: string): boolean {
        return Object.prototype.hasOwnProperty.call(CronJobConcurrencyPolicyCatalog.values, policy)
    }
}

import type { RepoEntityBase } from '@iappx/entity-repo'
import { CronJobEntity } from '@/domain/entities/workloads'

export class ResourceWorkload {
    public static desiredReplicas(entity: RepoEntityBase | null): number {
        const replicas = entity ? (entity as unknown as Record<string, unknown>).desiredReplicas : undefined

        return typeof replicas === 'number' ? replicas : 0
    }

    public static asCronJob(entity: RepoEntityBase | null): CronJobEntity | null {
        return entity instanceof CronJobEntity ? entity : null
    }
}

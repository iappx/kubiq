import { inject, injectable } from 'tsyringe'
import type { RepoEntityBase } from '@iappx/entity-repo'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { WorkloadAnnotations } from '@/application/services/workloadAction/constants/WorkloadAnnotations'
import type { TCronJobTriggerRequest } from '@/application/services/workloadAction/types/TCronJobTriggerRequest'
import type { TWorkloadTarget } from '@/application/services/workloadAction/types/TWorkloadTarget'
import { KubeEntitySets } from '@/infrastructure/entityRepo/kube/KubeEntitySets'
import { KubeUrlBuilder } from '@/infrastructure/entityRepo/kube/strategies/KubeUrlBuilder'

@injectable()
export class WorkloadActionService {
    public static readonly manualSuffix: string = '-manual-'

    // The 63 of a DNS-1123 label, less the five characters the API server appends.
    private static readonly maxGeneratedPrefix: number = 58

    constructor(
        @inject(ClusterConnectionService) private readonly connectionService: ClusterConnectionService,
    ) {}

    public async scale(target: TWorkloadTarget, replicas: number): Promise<void> {
        await this.patch(target, 'spec', { replicas })
    }

    public async restart(target: TWorkloadTarget, at: Date = new Date()): Promise<void> {
        await this.patch(target, 'spec', {
            template: {
                metadata: {
                    annotations: { [WorkloadAnnotations.restartedAt]: at.toISOString() },
                },
            },
        })
    }

    public async trigger(request: TCronJobTriggerRequest): Promise<string> {
        const cronJob = request.cronJob
        const query = KubeEntitySets.queryFor(
            this.connectionService.context(request.clusterId),
            request.jobKind,
            cronJob.namespace,
        )

        const job = query.entityConstructor.build({})
        job.setDataValue('apiVersion', request.jobKind.apiVersion)
        job.setDataValue('kind', request.jobKind.kind)
        job.setDataValue('metadata', {
            generateName: WorkloadActionService.generatedPrefix(cronJob.name),
            namespace: cronJob.namespace,
            labels: cronJob.jobTemplateLabels,
            annotations: {
                ...cronJob.jobTemplateAnnotations,
                [WorkloadAnnotations.instantiate]: WorkloadAnnotations.manual,
            },
            ownerReferences: [{
                apiVersion: cronJob.apiVersion,
                kind: cronJob.kind,
                name: cronJob.name,
                uid: cronJob.uid,
                controller: false,
                blockOwnerDeletion: true,
            }],
        })
        job.setDataValue('spec', cronJob.jobTemplateSpec)

        const created = await query.create(job)

        return WorkloadActionService.nameOf(created)
    }

    public static generatedPrefix(name: string): string {
        const room = WorkloadActionService.maxGeneratedPrefix - WorkloadActionService.manualSuffix.length

        return `${name.slice(0, room)}${WorkloadActionService.manualSuffix}`
    }

    // A fresh entity carrying only the changed field: patching the loaded one
    // would serialise its whole spec and write back everything it was holding.
    private patch(target: TWorkloadTarget, field: string, value: Record<string, unknown>): Promise<RepoEntityBase> {
        const query = KubeEntitySets.queryFor(
            this.connectionService.context(target.clusterId),
            target.kind,
            target.namespace,
        )

        const changes = query.entityConstructor.build({})
        changes.setDataValue(field, value)

        return query.withPathParams({ [KubeUrlBuilder.nameParam]: target.name }).patch(changes)
    }

    private static nameOf(entity: RepoEntityBase | undefined): string {
        const name = entity ? (entity as unknown as Record<string, unknown>).name : undefined

        return typeof name === 'string' ? name : ''
    }
}

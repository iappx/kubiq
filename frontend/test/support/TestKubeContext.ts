import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { RestEntityQuery } from '@iappx/entity-repo-rest'
import type { ITransport } from '@iappx/entity-repo'
import type { TRestRequest } from '@iappx/entity-repo-rest'
import { PodEntity } from '@/domain/entities/workloads'
import { KubeEntitySetOptions } from '@/infrastructure/entityRepo/kube/KubeEntitySetOptions'
import { TestPodEntity } from './TestPodEntity'

export class TestKubeContext extends EntityContextBase<ITransport<TRestRequest>> {
    @RepoEntitySet(() => TestPodEntity, () => RestEntityQuery, KubeEntitySetOptions.generic())
    public resources: RestEntityQuery<TestPodEntity>

    @RepoEntitySet(() => TestPodEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'pods'))
    public pods: RestEntityQuery<TestPodEntity>

    @RepoEntitySet(() => PodEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'pods'))
    public domainPods: RestEntityQuery<PodEntity>
}

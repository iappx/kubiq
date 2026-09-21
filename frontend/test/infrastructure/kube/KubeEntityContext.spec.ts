import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo, RepoEntityBase } from '@iappx/entity-repo'
import type { RestEntityQuery } from '@iappx/entity-repo-rest'
import type { Constructor } from '@/lib/types/Constructor'
import {
    ClusterRoleBindingEntity,
    ClusterRoleEntity,
    RoleBindingEntity,
    RoleEntity,
    ServiceAccountEntity,
} from '@/domain/entities/access'
import { EventEntity, NamespaceEntity, NodeEntity } from '@/domain/entities/cluster'
import { ConfigMapEntity, SecretEntity } from '@/domain/entities/config'
import { IngressEntity, ServiceEntity } from '@/domain/entities/network'
import {
    PersistentVolumeClaimEntity,
    PersistentVolumeEntity,
    StorageClassEntity,
} from '@/domain/entities/storage'
import {
    CronJobEntity,
    DaemonSetEntity,
    DeploymentEntity,
    JobEntity,
    PodEntity,
    ReplicaSetEntity,
    ReplicationControllerEntity,
    StatefulSetEntity,
} from '@/domain/entities/workloads'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeQueryMeta } from '@/infrastructure/entityRepo/kube/KubeQueryMeta'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const context = EntityRepo.create()
    .use(KubeEntityContext, transport as unknown as KubeTransport)
    .getContext(KubeEntityContext)

const sets = context as unknown as Record<string, RestEntityQuery<RepoEntityBase>>

const list = () => ({
    apiVersion: 'v1',
    kind: 'List',
    metadata: {},
    items: [{ metadata: { uid: 'uid-1', name: 'thing', namespace: 'dev' } }],
})

const cases: [string, string, Constructor<RepoEntityBase>][] = [
    ['pods', '/api/v1/namespaces/dev/pods', PodEntity],
    ['deployments', '/apis/apps/v1/namespaces/dev/deployments', DeploymentEntity],
    ['statefulSets', '/apis/apps/v1/namespaces/dev/statefulsets', StatefulSetEntity],
    ['daemonSets', '/apis/apps/v1/namespaces/dev/daemonsets', DaemonSetEntity],
    ['replicaSets', '/apis/apps/v1/namespaces/dev/replicasets', ReplicaSetEntity],
    ['replicationControllers', '/api/v1/namespaces/dev/replicationcontrollers', ReplicationControllerEntity],
    ['jobs', '/apis/batch/v1/namespaces/dev/jobs', JobEntity],
    ['cronJobs', '/apis/batch/v1/namespaces/dev/cronjobs', CronJobEntity],
    ['nodes', '/api/v1/nodes', NodeEntity],
    ['namespaces', '/api/v1/namespaces', NamespaceEntity],
    ['events', '/api/v1/namespaces/dev/events', EventEntity],
    ['configMaps', '/api/v1/namespaces/dev/configmaps', ConfigMapEntity],
    ['secrets', '/api/v1/namespaces/dev/secrets', SecretEntity],
    ['services', '/api/v1/namespaces/dev/services', ServiceEntity],
    ['ingresses', '/apis/networking.k8s.io/v1/namespaces/dev/ingresses', IngressEntity],
    ['persistentVolumes', '/api/v1/persistentvolumes', PersistentVolumeEntity],
    ['persistentVolumeClaims', '/api/v1/namespaces/dev/persistentvolumeclaims', PersistentVolumeClaimEntity],
    ['storageClasses', '/apis/storage.k8s.io/v1/storageclasses', StorageClassEntity],
    ['serviceAccounts', '/api/v1/namespaces/dev/serviceaccounts', ServiceAccountEntity],
    ['roles', '/apis/rbac.authorization.k8s.io/v1/namespaces/dev/roles', RoleEntity],
    ['roleBindings', '/apis/rbac.authorization.k8s.io/v1/namespaces/dev/rolebindings', RoleBindingEntity],
    ['clusterRoles', '/apis/rbac.authorization.k8s.io/v1/clusterroles', ClusterRoleEntity],
    ['clusterRoleBindings', '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings', ClusterRoleBindingEntity],
]

describe('KubeEntityContext', () => {
    beforeEach(() => {
        transport.reset()
    })

    it.each(cases)('lists %s at %s without naming a kind at the call site', async (set, path, entity) => {
        transport.answerWith(list())

        const [built] = await sets[set].withPathParams({ namespace: 'dev' }).getAll()

        expect(transport.path).toBe(path)
        expect(built).toBeInstanceOf(entity)
    })

    it('declares a typed set for every kind of the registry', () => {
        expect(cases).toHaveLength(KubeResourceRegistry.all().length)
    })

    it('still serves a kind named at the call site through the generic set', async () => {
        transport.answerWith(list())

        const built = await context.resources
            .withMeta(KubeQueryMeta.forKind(KubeResourceRegistry.all()[0]))
            .withPathParams({ namespace: 'dev' })
            .getAll()

        expect(built).toHaveLength(1)
    })
})

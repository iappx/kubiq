import { EntityContextBase, RepoEntitySet } from '@iappx/entity-repo'
import { RestEntityQuery } from '@iappx/entity-repo-rest'
import {
    ClusterRoleBindingEntity,
    ClusterRoleEntity,
    RoleBindingEntity,
    RoleEntity,
    ServiceAccountEntity,
} from '@/domain/entities/access'
import { EventEntity, NamespaceEntity, NodeEntity } from '@/domain/entities/cluster'
import { ConfigMapEntity, SecretEntity } from '@/domain/entities/config'
import { CustomResourceEntity } from '@/domain/entities/kube'
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
import { KubeEntitySetOptions } from '@/infrastructure/entityRepo/kube/KubeEntitySetOptions'
import { KubeTransport } from '@/infrastructure/entityRepo/kube/transport/KubeTransport'

export class KubeEntityContext extends EntityContextBase<KubeTransport> {
    // Carries no kind of its own: every query on this set has to name one with
    // withMeta(KubeQueryMeta.forKind(...)).
    @RepoEntitySet(() => CustomResourceEntity, () => RestEntityQuery, KubeEntitySetOptions.generic())
    public resources: RestEntityQuery<CustomResourceEntity>

    @RepoEntitySet(() => PodEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'pods'))
    public pods: RestEntityQuery<PodEntity>

    @RepoEntitySet(() => DeploymentEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('apps', 'deployments'))
    public deployments: RestEntityQuery<DeploymentEntity>

    @RepoEntitySet(() => StatefulSetEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('apps', 'statefulsets'))
    public statefulSets: RestEntityQuery<StatefulSetEntity>

    @RepoEntitySet(() => DaemonSetEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('apps', 'daemonsets'))
    public daemonSets: RestEntityQuery<DaemonSetEntity>

    @RepoEntitySet(() => ReplicaSetEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('apps', 'replicasets'))
    public replicaSets: RestEntityQuery<ReplicaSetEntity>

    @RepoEntitySet(() => ReplicationControllerEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'replicationcontrollers'))
    public replicationControllers: RestEntityQuery<ReplicationControllerEntity>

    @RepoEntitySet(() => JobEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('batch', 'jobs'))
    public jobs: RestEntityQuery<JobEntity>

    @RepoEntitySet(() => CronJobEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('batch', 'cronjobs'))
    public cronJobs: RestEntityQuery<CronJobEntity>

    @RepoEntitySet(() => NodeEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'nodes'))
    public nodes: RestEntityQuery<NodeEntity>

    @RepoEntitySet(() => NamespaceEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'namespaces'))
    public namespaces: RestEntityQuery<NamespaceEntity>

    @RepoEntitySet(() => EventEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'events'))
    public events: RestEntityQuery<EventEntity>

    @RepoEntitySet(() => ConfigMapEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'configmaps'))
    public configMaps: RestEntityQuery<ConfigMapEntity>

    @RepoEntitySet(() => SecretEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'secrets'))
    public secrets: RestEntityQuery<SecretEntity>

    @RepoEntitySet(() => ServiceEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'services'))
    public services: RestEntityQuery<ServiceEntity>

    @RepoEntitySet(() => IngressEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('networking.k8s.io', 'ingresses'))
    public ingresses: RestEntityQuery<IngressEntity>

    @RepoEntitySet(() => PersistentVolumeEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'persistentvolumes'))
    public persistentVolumes: RestEntityQuery<PersistentVolumeEntity>

    @RepoEntitySet(() => PersistentVolumeClaimEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'persistentvolumeclaims'))
    public persistentVolumeClaims: RestEntityQuery<PersistentVolumeClaimEntity>

    @RepoEntitySet(() => StorageClassEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('storage.k8s.io', 'storageclasses'))
    public storageClasses: RestEntityQuery<StorageClassEntity>

    @RepoEntitySet(() => ServiceAccountEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('', 'serviceaccounts'))
    public serviceAccounts: RestEntityQuery<ServiceAccountEntity>

    @RepoEntitySet(() => RoleEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('rbac.authorization.k8s.io', 'roles'))
    public roles: RestEntityQuery<RoleEntity>

    @RepoEntitySet(() => RoleBindingEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('rbac.authorization.k8s.io', 'rolebindings'))
    public roleBindings: RestEntityQuery<RoleBindingEntity>

    @RepoEntitySet(() => ClusterRoleEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('rbac.authorization.k8s.io', 'clusterroles'))
    public clusterRoles: RestEntityQuery<ClusterRoleEntity>

    @RepoEntitySet(() => ClusterRoleBindingEntity, () => RestEntityQuery, KubeEntitySetOptions.forResource('rbac.authorization.k8s.io', 'clusterrolebindings'))
    public clusterRoleBindings: RestEntityQuery<ClusterRoleBindingEntity>
}

import type {
    TApiGroupListDocument,
    TApiResourceListDocument,
    TApiVersionsDocument,
    TCustomResourceDefinitionDocument,
} from '@/domain/models/kube'

// Trimmed copies of what a v1.31 cluster answers on /api, /apis and
// /apis/{group}/{version}, keeping the cases discovery has to handle:
// subresources, a resource that cannot be listed, a group with no preferred
// version, and a superseded group version.
export class KubeDiscoveryFixtures {
    public static coreVersions(): TApiVersionsDocument {
        return { versions: ['v1'] }
    }

    public static groups(): TApiGroupListDocument {
        return {
            groups: [
                {
                    name: 'apps',
                    versions: [{ groupVersion: 'apps/v1', version: 'v1' }],
                    preferredVersion: { groupVersion: 'apps/v1', version: 'v1' },
                },
                {
                    name: 'batch',
                    versions: [
                        { groupVersion: 'batch/v1', version: 'v1' },
                        { groupVersion: 'batch/v1beta1', version: 'v1beta1' },
                    ],
                    preferredVersion: { groupVersion: 'batch/v1', version: 'v1' },
                },
                {
                    name: 'networking.k8s.io',
                    versions: [{ groupVersion: 'networking.k8s.io/v1', version: 'v1' }],
                    preferredVersion: { groupVersion: 'networking.k8s.io/v1', version: 'v1' },
                },
                {
                    name: 'rbac.authorization.k8s.io',
                    versions: [{ groupVersion: 'rbac.authorization.k8s.io/v1', version: 'v1' }],
                    preferredVersion: { groupVersion: 'rbac.authorization.k8s.io/v1', version: 'v1' },
                },
                {
                    name: 'storage.k8s.io',
                    versions: [{ groupVersion: 'storage.k8s.io/v1', version: 'v1' }],
                    preferredVersion: { groupVersion: 'storage.k8s.io/v1', version: 'v1' },
                },
                {
                    name: 'cert-manager.io',
                    versions: [{ groupVersion: 'cert-manager.io/v1', version: 'v1' }],
                    preferredVersion: { groupVersion: 'cert-manager.io/v1', version: 'v1' },
                },
                {
                    name: 'monitoring.coreos.com',
                    versions: [
                        { groupVersion: 'monitoring.coreos.com/v1alpha1', version: 'v1alpha1' },
                        { groupVersion: 'monitoring.coreos.com/v1', version: 'v1' },
                    ],
                },
            ],
        }
    }

    public static resourceLists(): TApiResourceListDocument[] {
        return [
            {
                groupVersion: 'v1',
                resources: [
                    { name: 'bindings', kind: 'Binding', namespaced: true, verbs: ['create'] },
                    { name: 'configmaps', kind: 'ConfigMap', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'events', kind: 'Event', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'namespaces', kind: 'Namespace', namespaced: false, verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch'] },
                    { name: 'namespaces/status', kind: 'Namespace', namespaced: false, verbs: ['get', 'patch', 'update'] },
                    { name: 'nodes', kind: 'Node', namespaced: false, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'persistentvolumeclaims', kind: 'PersistentVolumeClaim', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'persistentvolumes', kind: 'PersistentVolume', namespaced: false, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'pods', kind: 'Pod', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs(), shortNames: ['po'] },
                    { name: 'pods/exec', kind: 'PodExecOptions', namespaced: true, verbs: ['create', 'get'] },
                    { name: 'pods/log', kind: 'Pod', namespaced: true, verbs: ['get'] },
                    { name: 'pods/status', kind: 'Pod', namespaced: true, verbs: ['get', 'patch', 'update'] },
                    { name: 'secrets', kind: 'Secret', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'serviceaccounts', kind: 'ServiceAccount', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'services', kind: 'Service', namespaced: true, verbs: ['create', 'delete', 'get', 'list', 'patch', 'update', 'watch'] },
                ],
            },
            {
                groupVersion: 'apps/v1',
                resources: [
                    { name: 'daemonsets', kind: 'DaemonSet', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'deployments', kind: 'Deployment', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'deployments/scale', kind: 'Scale', namespaced: true, verbs: ['get', 'patch', 'update'] },
                    { name: 'replicasets', kind: 'ReplicaSet', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'statefulsets', kind: 'StatefulSet', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'batch/v1',
                resources: [
                    { name: 'cronjobs', kind: 'CronJob', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'jobs', kind: 'Job', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'batch/v1beta1',
                resources: [
                    { name: 'cronjobs', kind: 'CronJob', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'networking.k8s.io/v1',
                resources: [
                    { name: 'ingresses', kind: 'Ingress', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'rbac.authorization.k8s.io/v1',
                resources: [
                    { name: 'clusterrolebindings', kind: 'ClusterRoleBinding', namespaced: false, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'clusterroles', kind: 'ClusterRole', namespaced: false, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'rolebindings', kind: 'RoleBinding', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                    { name: 'roles', kind: 'Role', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'storage.k8s.io/v1',
                resources: [
                    { name: 'storageclasses', kind: 'StorageClass', namespaced: false, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'cert-manager.io/v1',
                resources: [
                    { name: 'certificates', kind: 'Certificate', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs(), shortNames: ['cert'] },
                    { name: 'certificates/status', kind: 'Certificate', namespaced: true, verbs: ['get', 'patch', 'update'] },
                    { name: 'issuers', kind: 'Issuer', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'monitoring.coreos.com/v1',
                resources: [
                    { name: 'prometheuses', kind: 'Prometheus', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
            {
                groupVersion: 'monitoring.coreos.com/v1alpha1',
                resources: [
                    { name: 'scrapeconfigs', kind: 'ScrapeConfig', namespaced: true, verbs: KubeDiscoveryFixtures.fullVerbs() },
                ],
            },
        ]
    }

    public static certificateCrd(): TCustomResourceDefinitionDocument {
        return {
            spec: {
                group: 'cert-manager.io',
                scope: 'Namespaced',
                names: { plural: 'certificates', singular: 'certificate', kind: 'Certificate', listKind: 'CertificateList', shortNames: ['cert'] },
                versions: [
                    {
                        name: 'v1alpha2',
                        served: false,
                        storage: false,
                        additionalPrinterColumns: [{ name: 'Ready', type: 'string', jsonPath: '.status.conditions[0].status' }],
                    },
                    {
                        name: 'v1',
                        served: true,
                        storage: true,
                        additionalPrinterColumns: [
                            { name: 'Ready', type: 'string', jsonPath: '.status.conditions[0].status' },
                            { name: 'Secret', type: 'string', jsonPath: '.spec.secretName' },
                            { name: 'Issuer', type: 'string', jsonPath: '.spec.issuerRef.name', priority: 1 },
                            { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp' },
                        ],
                    },
                ],
            },
        }
    }

    public static plainCrd(): TCustomResourceDefinitionDocument {
        return {
            spec: {
                group: 'example.test',
                scope: 'Cluster',
                names: { plural: 'widgets', singular: 'widget', kind: 'Widget' },
                versions: [{ name: 'v1', served: true, storage: true }],
            },
        }
    }

    public static full(): {
        coreVersions: TApiVersionsDocument
        groups: TApiGroupListDocument
        resourceLists: TApiResourceListDocument[]
        crds: TCustomResourceDefinitionDocument[]
    } {
        return {
            coreVersions: KubeDiscoveryFixtures.coreVersions(),
            groups: KubeDiscoveryFixtures.groups(),
            resourceLists: KubeDiscoveryFixtures.resourceLists(),
            crds: [KubeDiscoveryFixtures.certificateCrd()],
        }
    }

    private static fullVerbs(): string[] {
        return ['create', 'delete', 'deletecollection', 'get', 'list', 'patch', 'update', 'watch']
    }
}

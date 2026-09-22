import { KubeColumns } from '@/domain/models/kube/KubeColumns'
import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'
import { KubeVerbCatalog } from '@/domain/models/kube/KubeVerbCatalog'

// The version on each entry is only a starting guess; discovery replaces it with what the cluster reports.
export class KubeResourceRegistry {
    private static index: Map<string, KubeResourceKind> | undefined

    public static all(): KubeResourceKind[] {
        return [...KubeResourceRegistry.byKey().values()]
    }

    public static find(group: string, resource: string): KubeResourceKind | undefined {
        return KubeResourceRegistry.byKey().get(KubeResourceKind.registryKeyOf(group, resource))
    }

    public static has(group: string, resource: string): boolean {
        return KubeResourceRegistry.find(group, resource) !== undefined
    }

    public static findBySlug(slug: string): KubeResourceKind | undefined {
        const gvr = KubeResourceKind.parseSlug(slug)
        return KubeResourceRegistry.find(gvr.group, gvr.resource)
    }

    private static byKey(): Map<string, KubeResourceKind> {
        if (!KubeResourceRegistry.index) {
            const index = new Map<string, KubeResourceKind>()
            const kinds = KubeResourceRegistry.build()
            for (let i = 0; i < kinds.length; i++) {
                index.set(kinds[i].registryKey, kinds[i])
            }
            KubeResourceRegistry.index = index
        }
        return KubeResourceRegistry.index
    }

    private static build(): KubeResourceKind[] {
        return [
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'nodes', kind: 'Node',
                title: 'Nodes', namespaced: false, section: 'cluster', icon: 'Server',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'roles', title: 'Roles' },
                    { key: 'internalIp', title: 'Address' },
                    { key: 'kubeletVersion', title: 'Version' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'namespaces', kind: 'Namespace',
                title: 'Namespaces', namespaced: false, section: 'cluster', icon: 'FolderTree',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'phase', title: 'Phase' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'events', kind: 'Event',
                title: 'Events', namespaced: true, section: 'cluster', icon: 'Bell',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    { key: 'lastSeen', title: 'Last Seen' },
                    { key: 'type', title: 'Type' },
                    { key: 'reason', title: 'Reason' },
                    { key: 'involvedObjectText', title: 'Object' },
                    { key: 'message', title: 'Message' },
                    KubeColumns.namespace(),
                    { key: 'count', title: 'Count', align: 'right' },
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'pods', kind: 'Pod',
                title: 'Pods', namespaced: true, section: 'workloads', icon: 'Box',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    { key: 'containerHealth', title: 'Containers' },
                    KubeColumns.state(),
                    { key: 'restartCount', title: 'Restarts', align: 'right' },
                    { key: 'nodeName', title: 'Node' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'apps', version: 'v1', resource: 'deployments', kind: 'Deployment',
                title: 'Deployments', namespaced: true, section: 'workloads', icon: 'Layers',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    { key: 'updatedReplicas', title: 'Updated', align: 'right' },
                    { key: 'availableReplicas', title: 'Available', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'apps', version: 'v1', resource: 'statefulsets', kind: 'StatefulSet',
                title: 'Stateful Sets', namespaced: true, section: 'workloads', icon: 'Database',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    { key: 'serviceName', title: 'Service' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'apps', version: 'v1', resource: 'daemonsets', kind: 'DaemonSet',
                title: 'Daemon Sets', namespaced: true, section: 'workloads', icon: 'SquareStack',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    { key: 'misscheduledCount', title: 'Misscheduled', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'apps', version: 'v1', resource: 'replicasets', kind: 'ReplicaSet',
                title: 'Replica Sets', namespaced: true, section: 'workloads', icon: 'Blocks',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'replicationcontrollers', kind: 'ReplicationController',
                title: 'Replication Controllers', namespaced: true, section: 'workloads', icon: 'Copy',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Ready' },
                    { key: 'currentReplicas', title: 'Current', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'batch', version: 'v1', resource: 'jobs', kind: 'Job',
                title: 'Jobs', namespaced: true, section: 'workloads', icon: 'Play',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'readyText', title: 'Completions' },
                    { key: 'failedCount', title: 'Failed', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'batch', version: 'v1', resource: 'cronjobs', kind: 'CronJob',
                title: 'Cron Jobs', namespaced: true, section: 'workloads', icon: 'CalendarClock',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'schedule', title: 'Schedule' },
                    { key: 'lastScheduleTime', title: 'Last Schedule' },
                    { key: 'activeCount', title: 'Active', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'configmaps', kind: 'ConfigMap',
                title: 'Config Maps', namespaced: true, section: 'config', icon: 'FileText',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'keyCount', title: 'Keys', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'secrets', kind: 'Secret',
                title: 'Secrets', namespaced: true, section: 'config', icon: 'KeyRound',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'typeTitle', title: 'Type' },
                    { key: 'keyCount', title: 'Keys', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'resourcequotas', kind: 'ResourceQuota',
                title: 'Resource Quotas', namespaced: true, section: 'config', icon: 'Gauge',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'scopesText', title: 'Scopes' },
                    { key: 'limitCount', title: 'Limits', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'limitranges', kind: 'LimitRange',
                title: 'Limit Ranges', namespaced: true, section: 'config', icon: 'SlidersHorizontal',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'limitTypesText', title: 'Applies to' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'autoscaling', version: 'v2', resource: 'horizontalpodautoscalers', kind: 'HorizontalPodAutoscaler',
                title: 'Horizontal Pod Autoscalers', namespaced: true, section: 'config', icon: 'TrendingUp',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'targetText', title: 'Target' },
                    { key: 'replicaRange', title: 'Min–Max' },
                    { key: 'currentReplicas', title: 'Replicas', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'policy', version: 'v1', resource: 'poddisruptionbudgets', kind: 'PodDisruptionBudget',
                title: 'Pod Disruption Budgets', namespaced: true, section: 'config', icon: 'ShieldAlert',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'minAvailableText', title: 'Min available' },
                    { key: 'maxUnavailableText', title: 'Max unavailable' },
                    { key: 'currentHealthy', title: 'Healthy', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'scheduling.k8s.io', version: 'v1', resource: 'priorityclasses', kind: 'PriorityClass',
                title: 'Priority Classes', namespaced: false, section: 'config', icon: 'ArrowUpNarrowWide',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'value', title: 'Value', align: 'right' },
                    { key: 'isGlobalDefault', title: 'Global default' },
                    { key: 'preemptionPolicy', title: 'Preemption', priority: 1 },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'node.k8s.io', version: 'v1', resource: 'runtimeclasses', kind: 'RuntimeClass',
                title: 'Runtime Classes', namespaced: false, section: 'config', icon: 'Cpu',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'handler', title: 'Handler' },
                    { key: 'nodeSelectorText', title: 'Node selector', priority: 1 },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'coordination.k8s.io', version: 'v1', resource: 'leases', kind: 'Lease',
                title: 'Leases', namespaced: true, section: 'config', icon: 'Timer',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'holder', title: 'Holder' },
                    { key: 'durationSeconds', title: 'Duration', align: 'right', priority: 1 },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'services', kind: 'Service',
                title: 'Services', namespaced: true, section: 'network', icon: 'Network',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'type', title: 'Type' },
                    { key: 'clusterIp', title: 'Cluster IP' },
                    { key: 'externalAddressText', title: 'External IP' },
                    { key: 'portsText', title: 'Ports' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'networking.k8s.io', version: 'v1', resource: 'ingresses', kind: 'Ingress',
                title: 'Ingresses', namespaced: true, section: 'network', icon: 'Globe',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'ingressClassName', title: 'Class' },
                    { key: 'hostsText', title: 'Hosts' },
                    { key: 'addressText', title: 'Address' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'endpoints', kind: 'Endpoints',
                title: 'Endpoints', namespaced: true, section: 'network', icon: 'Waypoints',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'endpointsText', title: 'Endpoints' },
                    { key: 'readyCount', title: 'Ready', align: 'right' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'networking.k8s.io', version: 'v1', resource: 'ingressclasses', kind: 'IngressClass',
                title: 'Ingress Classes', namespaced: false, section: 'network', icon: 'Route',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'controller', title: 'Controller' },
                    { key: 'isDefault', title: 'Default' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'networking.k8s.io', version: 'v1', resource: 'networkpolicies', kind: 'NetworkPolicy',
                title: 'Network Policies', namespaced: true, section: 'network', icon: 'ShieldHalf',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'podSelectorText', title: 'Pod selector' },
                    { key: 'policyTypesText', title: 'Types' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'persistentvolumes', kind: 'PersistentVolume',
                title: 'Persistent Volumes', namespaced: false, section: 'storage', icon: 'HardDrive',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'capacity', title: 'Capacity', align: 'right' },
                    { key: 'accessModesText', title: 'Access Modes' },
                    { key: 'reclaimPolicy', title: 'Reclaim Policy' },
                    { key: 'claimText', title: 'Claim' },
                    { key: 'storageClassName', title: 'Storage Class' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'persistentvolumeclaims', kind: 'PersistentVolumeClaim',
                title: 'Persistent Volume Claims', namespaced: true, section: 'storage', icon: 'Disc',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'requestedStorage', title: 'Requested', align: 'right' },
                    { key: 'accessModesText', title: 'Access Modes' },
                    { key: 'storageClassName', title: 'Storage Class' },
                    { key: 'volumeName', title: 'Volume' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'storage.k8s.io', version: 'v1', resource: 'storageclasses', kind: 'StorageClass',
                title: 'Storage Classes', namespaced: false, section: 'storage', icon: 'Archive',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'provisioner', title: 'Provisioner' },
                    { key: 'reclaimPolicy', title: 'Reclaim Policy' },
                    { key: 'volumeBindingMode', title: 'Binding Mode' },
                    { key: 'isDefault', title: 'Default' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: '', version: 'v1', resource: 'serviceaccounts', kind: 'ServiceAccount',
                title: 'Service Accounts', namespaced: true, section: 'access', icon: 'CircleUser',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'secretCount', title: 'Secrets', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'rbac.authorization.k8s.io', version: 'v1', resource: 'roles', kind: 'Role',
                title: 'Roles', namespaced: true, section: 'access', icon: 'IdCard',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'ruleCount', title: 'Rules', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'rbac.authorization.k8s.io', version: 'v1', resource: 'rolebindings', kind: 'RoleBinding',
                title: 'Role Bindings', namespaced: true, section: 'access', icon: 'Users',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    KubeColumns.namespace(),
                    { key: 'roleName', title: 'Role' },
                    { key: 'subjectsText', title: 'Subjects' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'rbac.authorization.k8s.io', version: 'v1', resource: 'clusterroles', kind: 'ClusterRole',
                title: 'Cluster Roles', namespaced: false, section: 'access', icon: 'Shield',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'ruleCount', title: 'Rules', align: 'right' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'rbac.authorization.k8s.io', version: 'v1', resource: 'clusterrolebindings', kind: 'ClusterRoleBinding',
                title: 'Cluster Role Bindings', namespaced: false, section: 'access', icon: 'ShieldCheck',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'roleName', title: 'Role' },
                    { key: 'subjectsText', title: 'Subjects' },
                    KubeColumns.age(),
                ],
            }),
            new KubeResourceKind({
                group: 'apiextensions.k8s.io', version: 'v1', resource: 'customresourcedefinitions', kind: 'CustomResourceDefinition',
                title: 'Definitions', namespaced: false, section: 'custom', icon: 'Puzzle',
                verbs: KubeVerbCatalog.all(),
                columns: [
                    KubeColumns.objectName(),
                    { key: 'group', title: 'Group' },
                    { key: 'definedKind', title: 'Kind' },
                    { key: 'scope', title: 'Scope' },
                    { key: 'servedVersionsText', title: 'Versions' },
                    KubeColumns.state(),
                    KubeColumns.age(),
                ],
            }),
        ]
    }
}

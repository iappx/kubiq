import { describe, expect, it } from 'vitest'
import { KubeResourceKind, KubeResourceRegistry, KubeWorkloadCatalog } from '@/domain/models/kube'

const kind = (group: string, resource: string) => KubeResourceRegistry.find(group, resource)!

describe('KubeWorkloadCatalog', () => {
    it('knows what has a replica count to set', () => {
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'replicasets'))).toBe(true)
        expect(KubeWorkloadCatalog.canScale(kind('', 'replicationcontrollers'))).toBe(true)
    })

    it('knows what has none', () => {
        expect(KubeWorkloadCatalog.canScale(kind('apps', 'daemonsets'))).toBe(false)
        expect(KubeWorkloadCatalog.canScale(kind('batch', 'jobs'))).toBe(false)
        expect(KubeWorkloadCatalog.canScale(kind('', 'pods'))).toBe(false)
    })

    it('knows which controllers roll their pods on a template change', () => {
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'daemonsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canRestart(kind('apps', 'replicasets'))).toBe(false)
    })

    it('offers a manual run for cron jobs only', () => {
        expect(KubeWorkloadCatalog.canTrigger(kind('batch', 'cronjobs'))).toBe(true)
        expect(KubeWorkloadCatalog.canTrigger(kind('batch', 'jobs'))).toBe(false)
    })

    it('suspends cron jobs only, and only when the cluster lets the user patch them', () => {
        const readOnly = kind('batch', 'cronjobs').withDefinition({ verbs: ['list', 'get', 'watch'] })

        expect(KubeWorkloadCatalog.canSuspend(kind('batch', 'cronjobs'))).toBe(true)
        expect(KubeWorkloadCatalog.canSuspend(kind('batch', 'jobs'))).toBe(false)
        expect(KubeWorkloadCatalog.canSuspend(readOnly)).toBe(false)
    })

    it('forwards a port to what listens on one', () => {
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'pods'))).toBe(true)
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'services'))).toBe(true)
        expect(KubeWorkloadCatalog.canForwardPort(kind('apps', 'deployments'))).toBe(false)
        expect(KubeWorkloadCatalog.canForwardPort(kind('', 'nodes'))).toBe(false)
    })

    it('views logs on pods and pod-owning workloads only', () => {
        expect(KubeWorkloadCatalog.canViewLogs(kind('', 'pods'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('apps', 'daemonsets'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('apps', 'replicasets'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('batch', 'jobs'))).toBe(true)
        expect(KubeWorkloadCatalog.canViewLogs(kind('batch', 'cronjobs'))).toBe(false)
        expect(KubeWorkloadCatalog.canViewLogs(kind('', 'services'))).toBe(false)
        expect(KubeWorkloadCatalog.canViewLogs(kind('', 'configmaps'))).toBe(false)
    })

    it('identifies non-pod loggable workloads separately from pods', () => {
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('', 'pods'))).toBe(false)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('apps', 'deployments'))).toBe(true)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('apps', 'statefulsets'))).toBe(true)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('apps', 'daemonsets'))).toBe(true)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('apps', 'replicasets'))).toBe(true)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('batch', 'jobs'))).toBe(true)
        expect(KubeWorkloadCatalog.isLoggableWorkload(kind('batch', 'cronjobs'))).toBe(false)
    })

    it('allows attaching a debug container only to pods the user can patch or update', () => {
        const readOnlyPod = kind('', 'pods').withDefinition({ verbs: ['list', 'get', 'watch'] })
        const patchOnlyPod = kind('', 'pods').withDefinition({ verbs: ['list', 'get', 'patch'] })
        const updateOnlyPod = kind('', 'pods').withDefinition({ verbs: ['list', 'get', 'update'] })

        expect(KubeWorkloadCatalog.canDebug(kind('', 'pods'))).toBe(true)
        expect(KubeWorkloadCatalog.canDebug(patchOnlyPod)).toBe(true)
        expect(KubeWorkloadCatalog.canDebug(updateOnlyPod)).toBe(true)
        expect(KubeWorkloadCatalog.canDebug(readOnlyPod)).toBe(false)
        expect(KubeWorkloadCatalog.canDebug(kind('apps', 'deployments'))).toBe(false)
    })

    it('knows which kinds carry a pod template of their own', () => {
        const templated = KubeResourceRegistry.all()
            .filter(candidate => KubeWorkloadCatalog.hasPodTemplate(candidate))
            .map(candidate => candidate.kind)

        expect(templated).toEqual([
            'Deployment',
            'StatefulSet',
            'DaemonSet',
            'ReplicaSet',
            'ReplicationController',
            'Job',
            'CronJob',
        ])
    })

    it('does not call a pod a template of itself', () => {
        expect(KubeWorkloadCatalog.hasPodTemplate(kind('', 'pods'))).toBe(false)
    })

    it('offers nothing the cluster does not let the user patch', () => {
        const readOnly = kind('apps', 'deployments').withDefinition({ verbs: ['list', 'get', 'watch'] })

        expect(KubeWorkloadCatalog.canScale(readOnly)).toBe(false)
        expect(KubeWorkloadCatalog.canRestart(readOnly)).toBe(false)
    })

    it('summarises the four kinds an operator looks at first, in that order', () => {
        const summarised = KubeResourceRegistry.all()
            .filter(candidate => KubeWorkloadCatalog.isSummarised(candidate))
            .sort((a, b) => KubeWorkloadCatalog.summaryOrder(a) - KubeWorkloadCatalog.summaryOrder(b))

        expect(summarised.map(candidate => candidate.kind)).toEqual(['Pod', 'Deployment', 'StatefulSet', 'DaemonSet'])
    })

    it('expands overview health summaries to cluster, workload, policy, storage, cert-manager and Flux kinds', () => {
        const customKinds = [
            new KubeResourceKind({
                group: 'cert-manager.io', version: 'v1', resource: 'certificates', kind: 'Certificate',
                title: 'Certificate', namespaced: true, section: 'custom', icon: 'Puzzle', columns: [], verbs: ['list'], isCustom: true,
            }),
            new KubeResourceKind({
                group: 'kustomize.toolkit.fluxcd.io', version: 'v1', resource: 'kustomizations', kind: 'Kustomization',
                title: 'Kustomization', namespaced: true, section: 'gitops', icon: 'Layers', columns: [], verbs: ['list'], isCustom: true,
            }),
            new KubeResourceKind({
                group: 'helm.toolkit.fluxcd.io', version: 'v2', resource: 'helmreleases', kind: 'HelmRelease',
                title: 'HelmRelease', namespaced: true, section: 'gitops', icon: 'Blocks', columns: [], verbs: ['list'], isCustom: true,
            }),
        ]

        const overview = [...KubeResourceRegistry.all(), ...customKinds]
            .filter(candidate => KubeWorkloadCatalog.isOverviewSummarised(candidate))
            .sort((a, b) => KubeWorkloadCatalog.overviewOrder(a) - KubeWorkloadCatalog.overviewOrder(b))

        expect(overview.map(candidate => candidate.kind)).toEqual([
            'Node',
            'PersistentVolume',
            'Pod',
            'Deployment',
            'DaemonSet',
            'StatefulSet',
            'CronJob',
            'Job',
            'HorizontalPodAutoscaler',
            'ResourceQuota',
            'PodDisruptionBudget',
            'PersistentVolumeClaim',
            'Certificate',
            'Kustomization',
            'HelmRelease',
        ])
    })
})

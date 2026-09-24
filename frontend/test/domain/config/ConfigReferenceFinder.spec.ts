import { describe, expect, it } from 'vitest'
import { ConfigReferenceFinder, ConfigReferenceUseCatalog } from '@/domain/entities/config'
import type { TConfigReferenceTarget } from '@/domain/entities/config'

const configMap: TConfigReferenceTarget = { objectKind: 'configMap', name: 'app-config' }
const secret: TConfigReferenceTarget = { objectKind: 'secret', name: 'app-secret' }

const container = (extra: Record<string, unknown>): Record<string, unknown> => ({ name: 'app', image: 'app:1', ...extra })

const pod = (spec: Record<string, unknown>): Record<string, unknown> => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'app-0', namespace: 'shop' },
    spec: { containers: [container({})], ...spec },
})

const deployment = (podSpec: Record<string, unknown>): Record<string, unknown> => ({
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'app', namespace: 'shop' },
    spec: { template: { spec: { containers: [container({})], ...podSpec } } },
})

const cronJob = (podSpec: Record<string, unknown>): Record<string, unknown> => ({
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: { name: 'nightly', namespace: 'shop' },
    spec: { jobTemplate: { spec: { template: { spec: { containers: [container({})], ...podSpec } } } } },
})

describe('ConfigReferenceFinder volumes', () => {
    it('finds a config map mounted as a volume', () => {
        const object = pod({ volumes: [{ name: 'config', configMap: { name: 'app-config' } }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual(['volume'])
    })

    it('finds a secret mounted as a volume by its secretName', () => {
        const object = pod({ volumes: [{ name: 'certs', secret: { secretName: 'app-secret' } }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['volume'])
    })

    it('does not take a secret volume for a config map of the same name', () => {
        const object = pod({ volumes: [{ name: 'certs', secret: { secretName: 'app-config' } }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual([])
    })

    it('finds both kinds among the sources of a projected volume', () => {
        const object = pod({
            volumes: [{
                name: 'bundle',
                projected: {
                    sources: [
                        { serviceAccountToken: { path: 'token' } },
                        { configMap: { name: 'app-config' } },
                        { secret: { name: 'app-secret' } },
                    ],
                },
            }],
        })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual(['projectedVolume'])
        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['projectedVolume'])
    })
})

describe('ConfigReferenceFinder environment', () => {
    it('finds a config map imported whole through envFrom', () => {
        const object = pod({ containers: [container({ envFrom: [{ configMapRef: { name: 'app-config' } }] })] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual(['envFrom'])
    })

    it('finds a secret imported whole through envFrom', () => {
        const object = pod({ containers: [container({ envFrom: [{ prefix: 'DB_', secretRef: { name: 'app-secret' } }] })] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['envFrom'])
    })

    it('finds a single key read through configMapKeyRef', () => {
        const object = pod({
            containers: [container({
                env: [
                    { name: 'LEVEL', value: 'debug' },
                    { name: 'MODE', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'mode' } } },
                ],
            })],
        })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual(['env'])
    })

    it('finds a single key read through secretKeyRef', () => {
        const object = pod({
            containers: [container({ env: [{ name: 'TOKEN', valueFrom: { secretKeyRef: { name: 'app-secret', key: 'token' } } }] })],
        })

        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['env'])
    })

    it('looks into init containers', () => {
        const object = pod({ initContainers: [container({ envFrom: [{ configMapRef: { name: 'app-config' } }] })] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual(['envFrom'])
    })

    it('looks into ephemeral containers', () => {
        const object = pod({
            ephemeralContainers: [container({ env: [{ name: 'T', valueFrom: { secretKeyRef: { name: 'app-secret', key: 't' } } }] })],
        })

        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['env'])
    })

    it('does not take a secretKeyRef for a config map of the same name', () => {
        const object = pod({
            containers: [container({ env: [{ name: 'T', valueFrom: { secretKeyRef: { name: 'app-config', key: 't' } } }] })],
        })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual([])
    })
})

describe('ConfigReferenceFinder image pull secrets', () => {
    it('finds a secret a pod pulls its images with', () => {
        const object = pod({ imagePullSecrets: [{ name: 'registry' }, { name: 'app-secret' }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, secret)).toEqual(['imagePullSecret'])
    })

    it('finds it on the pod template of a workload', () => {
        const object = deployment({ imagePullSecrets: [{ name: 'app-secret' }] })

        expect(ConfigReferenceFinder.usesIn('Deployment', object, secret)).toEqual(['imagePullSecret'])
    })

    it('never counts a pull secret as a config map reference', () => {
        const object = pod({ imagePullSecrets: [{ name: 'app-config' }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual([])
    })
})

describe('ConfigReferenceFinder workload templates', () => {
    it('reads the pod template of a deployment', () => {
        const object = deployment({ volumes: [{ name: 'config', configMap: { name: 'app-config' } }] })

        expect(ConfigReferenceFinder.usesIn('Deployment', object, configMap)).toEqual(['volume'])
    })

    it('reads the job template of a cron job', () => {
        const object = cronJob({ containers: [container({ envFrom: [{ secretRef: { name: 'app-secret' } }] })] })

        expect(ConfigReferenceFinder.usesIn('CronJob', object, secret)).toEqual(['envFrom'])
    })

    it('names every way one object uses the target, in a fixed order', () => {
        const object = deployment({
            volumes: [
                { name: 'certs', secret: { secretName: 'app-secret' } },
                { name: 'bundle', projected: { sources: [{ secret: { name: 'app-secret' } }] } },
            ],
            containers: [container({
                envFrom: [{ secretRef: { name: 'app-secret' } }],
                env: [{ name: 'T', valueFrom: { secretKeyRef: { name: 'app-secret', key: 't' } } }],
            })],
            imagePullSecrets: [{ name: 'app-secret' }],
        })

        expect(ConfigReferenceFinder.usesIn('Deployment', object, secret))
            .toEqual(['volume', 'projectedVolume', 'envFrom', 'env', 'imagePullSecret'])
    })

    it('finds nothing in a workload that names other objects only', () => {
        const object = deployment({
            volumes: [{ name: 'config', configMap: { name: 'other' } }],
            containers: [container({ envFrom: [{ configMapRef: { name: 'other' } }] })],
        })

        expect(ConfigReferenceFinder.usesIn('Deployment', object, configMap)).toEqual([])
    })

    it('survives a malformed spec', () => {
        const object = { spec: { containers: 'nope', volumes: [null, 7, { configMap: 'x' }] } }

        expect(ConfigReferenceFinder.usesIn('Pod', object, configMap)).toEqual([])
        expect(ConfigReferenceFinder.usesIn('Pod', {}, configMap)).toEqual([])
    })
})

describe('ConfigReferenceFinder service accounts', () => {
    const account = {
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata: { name: 'builder', namespace: 'shop' },
        secrets: [{ name: 'builder-token' }, { name: 'app-secret' }],
        imagePullSecrets: [{ name: 'app-secret' }],
    }

    it('finds a secret listed under secrets and under imagePullSecrets', () => {
        expect(ConfigReferenceFinder.usesIn('ServiceAccount', account, secret)).toEqual(['mountableSecret', 'imagePullSecret'])
    })

    it('finds nothing when the account lists other secrets', () => {
        expect(ConfigReferenceFinder.usesIn('ServiceAccount', account, { objectKind: 'secret', name: 'other' })).toEqual([])
    })

    it('never matches a config map', () => {
        const named = { ...account, secrets: [{ name: 'app-config' }] }

        expect(ConfigReferenceFinder.usesIn('ServiceAccount', named, configMap)).toEqual([])
    })
})

describe('ConfigReferenceFinder ingresses', () => {
    const ingress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: { name: 'web', namespace: 'shop' },
        spec: { tls: [{ hosts: ['shop.example.test'], secretName: 'app-secret' }, { hosts: ['x.example.test'] }] },
    }

    it('finds a secret that terminates TLS', () => {
        expect(ConfigReferenceFinder.usesIn('Ingress', ingress, secret)).toEqual(['tls'])
    })

    it('finds nothing on an ingress without TLS', () => {
        expect(ConfigReferenceFinder.usesIn('Ingress', { spec: {} }, secret)).toEqual([])
    })

    it('never matches a config map', () => {
        expect(ConfigReferenceFinder.usesIn('Ingress', ingress, { objectKind: 'configMap', name: 'app-secret' })).toEqual([])
    })
})

describe('ConfigReferenceFinder referrers', () => {
    const kindsOf = (target: TConfigReferenceTarget): string[] =>
        ConfigReferenceFinder.referrersOf(target.objectKind).map(referrer => referrer.kind)

    it('looks for config map users among workloads and pods', () => {
        expect(kindsOf(configMap)).toEqual(['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod'])
    })

    it('adds service accounts and ingresses for a secret', () => {
        expect(kindsOf(secret)).toEqual([
            'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod', 'ServiceAccount', 'Ingress',
        ])
    })

    it('matches nothing for a target without a name', () => {
        const object = pod({ volumes: [{ name: 'empty', configMap: {} }] })

        expect(ConfigReferenceFinder.usesIn('Pod', object, { objectKind: 'configMap', name: '' })).toEqual([])
    })
})

describe('ConfigReferenceUseCatalog', () => {
    it('describes the uses in the words the manifest uses', () => {
        expect(ConfigReferenceUseCatalog.describe(['volume', 'env', 'imagePullSecret'])).toBe('volume, env, imagePullSecrets')
    })
})

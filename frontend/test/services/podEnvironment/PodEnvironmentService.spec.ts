import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClipboardService } from '@/application/services/clipboard/ClipboardService'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { PodEnvironmentService } from '@/application/services/podEnvironment/PodEnvironmentService'
import { ResourceYamlService } from '@/application/services/resourceYaml/ResourceYamlService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeContextProvider } from '@/infrastructure/entityRepo/kube/KubeContextProvider'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeObjectAdapter } from '@/infrastructure/kube/KubeObjectAdapter'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const served = [
    KubeResourceRegistry.find('', 'pods')!,
    KubeResourceRegistry.find('', 'configmaps')!,
    KubeResourceRegistry.find('', 'secrets')!,
]

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
    connection: () => ({ clusterId: 'prod', sessionId: 'session-1' }),
    connections: [{ clusterId: 'prod', sessionId: 'session-1' }],
} as unknown as ClusterConnectionService

const contexts = { request: () => transport } as unknown as KubeContextProvider

const copied: string[] = []

const clipboard = {
    write: async (text: string) => {
        copied.push(text)
    },
} as unknown as ClipboardService

const pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'api-7d9-abcde', namespace: 'payments', uid: 'p-1' },
    spec: {
        containers: [{
            name: 'api',
            env: [
                { name: 'LOG_LEVEL', value: 'debug' },
                { name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } },
                { name: 'APP_TIER', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'tier' } } },
                { name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: 'db-creds', key: 'password' } } },
                { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } },
            ],
        }],
    },
}

const podReading = (valueFrom: Record<string, unknown>) => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'api-7d9-abcde', namespace: 'payments' },
    spec: { containers: [{ name: 'api', env: [{ name: 'DB_PASSWORD', valueFrom }] }] },
})

const appConfig = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'app-config', namespace: 'payments' },
    data: { url: 'https://api.internal', tier: 'gold' },
}

const dbCreds = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name: 'db-creds', namespace: 'payments' },
    data: { password: btoa('placeholder-value') },
}

let service: PodEnvironmentService

const request = { clusterId: 'prod', object: pod, served }

const entryFor = async (variable: string) => {
    const groups = await service.describe(request)

    return groups[0].entries.find(entry => entry.variable === variable)
}

describe('PodEnvironmentService.describe', () => {
    beforeEach(() => {
        transport.reset()
        copied.length = 0
        service = new PodEnvironmentService(
            new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts)),
            clipboard,
        )
    })

    it('reads each referenced object once however many variables come out of it', async () => {
        transport.answerWith(appConfig)
        transport.answerWith(dbCreds)

        await service.describe(request)

        expect(transport.requests.map(sent => sent.url)).toEqual([
            '/api/v1/namespaces/payments/configmaps/app-config',
            '/api/v1/namespaces/payments/secrets/db-creds',
        ])
    })

    it('asks the cluster for nothing when the pod only carries literals and paths', async () => {
        await service.describe({
            ...request,
            object: { metadata: { namespace: 'payments' }, spec: { containers: [{ name: 'api', env: [{ name: 'A', value: '1' }] }] } },
        })

        expect(transport.requests).toHaveLength(0)
    })

    it('shows the value a ConfigMap holds beside the reference it came from', async () => {
        transport.answerWith(appConfig)
        transport.answerWith(dbCreds)

        expect(await entryFor('APP_URL')).toMatchObject({
            value: 'https://api.internal',
            provenance: 'configmap/app-config · key: url',
            masked: false,
            state: 'resolved',
        })
    })

    it('decodes what a Secret holds and marks it as one to hide', async () => {
        transport.answerWith(appConfig)
        transport.answerWith(dbCreds)

        expect(await entryFor('DB_PASSWORD')).toMatchObject({
            value: 'placeholder-value',
            masked: true,
            state: 'resolved',
        })
    })

    it('expands an envFrom map into one entry per key, honouring the prefix', async () => {
        transport.answerWith({ ...appConfig, metadata: { name: 'feature-flags', namespace: 'payments' }, data: { new_ui: 'true' } })

        const groups = await service.describe({
            ...request,
            object: {
                metadata: { namespace: 'payments' },
                spec: { containers: [{ name: 'api', envFrom: [{ prefix: 'FEATURE_', configMapRef: { name: 'feature-flags' } }] }] },
            },
        })

        expect(groups[0].entries).toEqual([expect.objectContaining({ variable: 'FEATURE_new_ui', value: 'true' })])
    })

    it('reads a workload pod template and resolves it in the workload own namespace', async () => {
        transport.answerWith(appConfig)

        const groups = await service.describe({
            ...request,
            object: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: { name: 'api', namespace: 'billing' },
                spec: {
                    replicas: 3,
                    template: {
                        spec: {
                            containers: [{
                                name: 'api',
                                env: [{ name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } }],
                            }],
                        },
                    },
                },
            },
        })

        expect(transport.last.url).toBe('/api/v1/namespaces/billing/configmaps/app-config')
        expect(groups[0].entries[0]).toMatchObject({ variable: 'APP_URL', value: 'https://api.internal' })
    })

    it('reads a cron job through both of its templates', async () => {
        transport.answerWith(appConfig)

        const groups = await service.describe({
            ...request,
            object: {
                apiVersion: 'batch/v1',
                kind: 'CronJob',
                metadata: { name: 'report', namespace: 'payments' },
                spec: {
                    schedule: '0 * * * *',
                    jobTemplate: {
                        spec: {
                            template: {
                                spec: {
                                    containers: [{
                                        name: 'report',
                                        env: [{ name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } }],
                                    }],
                                },
                            },
                        },
                    },
                },
            },
        })

        expect(groups.map(group => group.container)).toEqual(['report'])
        expect(groups[0].entries[0]).toMatchObject({ value: 'https://api.internal', state: 'resolved' })
    })

    it('calls an optional reference that is not in the cluster unresolved rather than failing', async () => {
        transport.failWith(new ApiError('Not found', 'NotFound', 404))

        const groups = await service.describe({
            ...request,
            object: podReading({ secretKeyRef: { name: 'db-creds', key: 'password', optional: true } }),
        })

        expect(groups[0].entries[0]).toMatchObject({ state: 'unresolved', value: '' })
    })

    it('says a refused reference is not permitted and still names it', async () => {
        transport.failWith(new ApiError('Denied', 'Forbidden', 403))

        const groups = await service.describe({
            ...request,
            object: podReading({ secretKeyRef: { name: 'db-creds', key: 'password' } }),
        })

        expect(groups[0].entries[0]).toMatchObject({
            state: 'forbidden',
            provenance: 'secret/db-creds · key: password',
            value: '',
        })
    })

    it('lets a failure that is neither absence nor a refusal reach the caller', async () => {
        transport.failWith(new ApiError('Broken', 'InternalError', 500))

        await expect(service.describe({
            ...request,
            object: podReading({ secretKeyRef: { name: 'db-creds', key: 'password' } }),
        })).rejects.toThrow('Broken')
    })
})

describe('PodEnvironmentService copying', () => {
    beforeEach(() => {
        transport.reset()
        copied.length = 0
        service = new PodEnvironmentService(
            new ResourceYamlService(connectionService, new KubeObjectAdapter(contexts)),
            clipboard,
        )
    })

    it('copies one value without needing it revealed first', async () => {
        transport.answerWith(appConfig)
        transport.answerWith(dbCreds)
        const secret = await entryFor('DB_PASSWORD')

        await service.copyEntry(secret!)

        expect(copied).toEqual(['placeholder-value'])
    })

    it('copies a container as assignments and reports how many it wrote', async () => {
        transport.answerWith(appConfig)
        transport.answerWith(dbCreds)
        const groups = await service.describe(request)

        const count = await service.copyGroup(groups[0])

        expect(count).toBe(4)
        expect(copied[0]).toBe([
            'LOG_LEVEL=debug',
            'APP_URL=https://api.internal',
            'APP_TIER=gold',
            'DB_PASSWORD=placeholder-value',
        ].join('\n'))
    })
})

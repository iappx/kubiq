import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ArgoService } from '@/application/services/argocd/ArgoService'
import type { TArgoApplicationTarget } from '@/application/services/argocd/types/TArgoApplicationTarget'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { ArgoSyncDraftDefaults, ArgoAnnotations, ArgoResourceKinds } from '@/domain/models/argocd'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubePatchRequestFactory } from '@/infrastructure/entityRepo/kube/strategies/KubePatchRequestFactory'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()

const connectionService = {
    context: () => EntityRepo.create().use(KubeEntityContext, transport as never).getContext(KubeEntityContext),
} as unknown as ClusterConnectionService

const applications = ArgoResourceKinds.applications()

const target: TArgoApplicationTarget = {
    clusterId: 'prod',
    kind: applications,
    namespace: 'argocd',
    name: 'web',
}

const body = () => (transport.last.body ?? {}) as Record<string, any>

let service: ArgoService

describe('ArgoService.listApplications', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    // Argo CD is a cluster-wide control plane; scoping its own objects to the selected
    // namespaces would hide every application in a standard installation.
    it('lists across every namespace, not the operator scope', async () => {
        transport.answerWith({ items: [] })

        await service.listApplications('prod', applications)

        expect(transport.last.url).toBe('/apis/argoproj.io/v1alpha1/applications')
        expect(transport.last.method).toBe('GET')
    })

    it('builds typed applications out of what the API server answered', async () => {
        transport.answerWith({
            items: [{
                metadata: { uid: 'app-uid', name: 'web', namespace: 'argocd' },
                spec: { project: 'payments' },
                status: { sync: { status: 'OutOfSync' }, health: { status: 'Degraded' } },
            }],
        })

        const [application] = await service.listApplications('prod', applications)

        expect(application.name).toBe('web')
        expect(application.project).toBe('payments')
        expect(application.syncStatus).toBe('OutOfSync')
        expect(application.state).toBe('error')
    })
})

describe('ArgoService.sync', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    it('patches the application the operator picked', async () => {
        transport.answerWith({})

        await service.sync(target, ArgoSyncDraftDefaults.blank())

        expect(transport.last.url).toBe('/apis/argoproj.io/v1alpha1/namespaces/argocd/applications/web')
        expect(transport.last.method).toBe('PATCH')
        expect(transport.last.headers?.['content-type']).toBe(KubePatchRequestFactory.mergePatchType)
    })

    it('writes the operation field and nothing else', async () => {
        transport.answerWith({})

        await service.sync(target, ArgoSyncDraftDefaults.blank())

        expect(body()).toEqual({
            operation: {
                initiatedBy: { username: 'kubiq', automated: false },
                sync: { prune: false, dryRun: false },
            },
        })
    })

    it('carries the revision and source of a rollback', async () => {
        transport.answerWith({})
        const source = { repoURL: 'https://git/acme/web', path: 'deploy' }

        await service.sync(target, ArgoSyncDraftDefaults.atRevision('abc123'), source)

        expect(body().operation.sync).toMatchObject({ revision: 'abc123', source })
    })
})

describe('ArgoService.refresh', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    it('stamps the annotation the application controller watches', async () => {
        transport.answerWith({})

        await service.refresh(target, false)

        expect(body()).toEqual({ metadata: { annotations: { [ArgoAnnotations.refresh]: 'normal' } } })
    })

    it('asks for a hard refresh when the manifests have to be re-read', async () => {
        transport.answerWith({})

        await service.refresh(target, true)

        expect(body().metadata.annotations[ArgoAnnotations.refresh]).toBe('hard')
    })
})

describe('ArgoService.terminate', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    it('moves the running operation into Terminating', async () => {
        transport.answerWith({})

        await service.terminate(target)

        expect(body()).toEqual({ status: { operationState: { phase: 'Terminating' } } })
    })
})

describe('ArgoService.setAutomatedSync', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    it('turns automation on with the flags it was handed', async () => {
        transport.answerWith({})

        await service.setAutomatedSync(target, { prune: true, selfHeal: false })

        expect(body()).toEqual({ spec: { syncPolicy: { automated: { prune: true, selfHeal: false } } } })
    })

    // A merge patch erases a key by sending null; leaving it out would change nothing.
    it('turns automation off by erasing the key', async () => {
        transport.answerWith({})

        await service.setAutomatedSync(target, null)

        expect(body()).toEqual({ spec: { syncPolicy: { automated: null } } })
    })
})

describe('ArgoService.remove', () => {
    beforeEach(() => {
        transport.reset()
        service = new ArgoService(connectionService)
    })

    it('adds the cascade finalizer before deleting, so the resources go too', async () => {
        transport.answerWith({})
        transport.answerWith({})

        await service.remove(target, true, [])

        expect(transport.requests).toHaveLength(2)
        expect(transport.requests[0].method).toBe('PATCH')
        expect(transport.requests[0].body).toEqual({
            metadata: { finalizers: [ArgoAnnotations.resourcesFinalizer] },
        })
        expect(transport.requests[1].method).toBe('DELETE')
    })

    it('strips the finalizer when the resources should stay in the cluster', async () => {
        transport.answerWith({})
        transport.answerWith({})

        await service.remove(target, false, [ArgoAnnotations.resourcesFinalizer])

        expect(transport.requests[0].body).toEqual({ metadata: { finalizers: [] } })
    })

    it('does not patch an application that already carries what was asked for', async () => {
        transport.answerWith({})

        await service.remove(target, false, [])

        expect(transport.requests).toHaveLength(1)
        expect(transport.last.method).toBe('DELETE')
        expect(transport.last.url).toBe('/apis/argoproj.io/v1alpha1/namespaces/argocd/applications/web')
    })
})

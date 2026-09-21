import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import { KubeFilters, KubeSelectorPath } from '@/domain/entities/kube'
import { PodFilters } from '@/domain/entities/workloads'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { TestKubeContext } from '../../support/TestKubeContext'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create().use(TestKubeContext, transport).getContext(TestKubeContext)

describe('KubeSelectorFilterEncoder', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('compiles a path of several segments into a field selector', async () => {
        await context.pods.where(f => PodFilters.onNode(f, 'node-a')).getAll()

        expect(transport.last.query).toEqual({ fieldSelector: 'spec.nodeName=node-a' })
    })

    it('compiles a name condition into a field selector', async () => {
        await context.pods.where(f => KubeFilters.named(f, 'web-1')).getAll()

        expect(transport.last.query).toEqual({ fieldSelector: 'metadata.name=web-1' })
    })

    it('joins every field requirement into one selector', async () => {
        await context.pods.where(f => PodFilters.onNodeInNamespace(f, 'node-a', 'dev')).getAll()

        expect(transport.last.query).toEqual({ fieldSelector: 'spec.nodeName=node-a,metadata.namespace=dev' })
    })

    it('compiles an inequality into a field selector', async () => {
        await context.pods.where(f => f.opPath(QueryOperators.ne, ['status', 'phase'], 'Running')).getAll()

        expect(transport.last.query).toEqual({ fieldSelector: 'status.phase!=Running' })
    })

    it('compiles a label condition into a label selector', async () => {
        await context.pods.where(f => KubeFilters.withLabel(f, 'app', 'web')).getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app=web' })
    })

    it('joins every label requirement into one selector', async () => {
        await context.pods.where(f => KubeFilters.withLabels(f, { app: 'web', tier: 'front' })).getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app=web,tier=front' })
    })

    it('compiles a set membership into a label selector', async () => {
        await context.pods
            .where(f => f.opPath(QueryOperators.in, KubeSelectorPath.labelPath('tier'), ['web', 'api']))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'tier in (web,api)' })
    })

    it('compiles an excluded set into a label selector', async () => {
        await context.pods
            .where(f => f.opPath(QueryOperators.notIn, KubeSelectorPath.labelPath('tier'), ['web', 'api']))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'tier notin (web,api)' })
    })

    it('compiles the presence of a label', async () => {
        await context.pods
            .where(f => f.opPath(QueryOperators.isNull, KubeSelectorPath.labelPath('app'), false))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app' })
    })

    it('compiles the absence of a label', async () => {
        await context.pods
            .where(f => f.opPath(QueryOperators.isNull, KubeSelectorPath.labelPath('legacy'), true))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: '!legacy' })
    })

    it('compiles a label inequality', async () => {
        await context.pods
            .where(f => f.opPath(QueryOperators.ne, KubeSelectorPath.labelPath('app'), 'web'))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app!=web' })
    })

    it('keeps labels and fields in selectors of their own', async () => {
        await context.pods
            .where(f => f.and(KubeFilters.withLabel(f, 'app', 'web'), PodFilters.running(f)))
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app=web', fieldSelector: 'status.phase=Running' })
    })

    it('appends a raw selector to the compiled one', async () => {
        await context.pods
            .where(f => KubeFilters.withLabel(f, 'app', 'web'))
            .rawFilter({ labelSelector: 'tier=front' })
            .getAll()

        expect(transport.last.query).toEqual({ labelSelector: 'app=web,tier=front' })
    })

    it('refuses a set membership on a field, which the API server cannot express', async () => {
        const failing = context.pods
            .where(f => f.opPath(QueryOperators.in, ['status', 'phase'], ['Running', 'Pending']))
            .getAll()

        await expect(failing).rejects.toThrow(UnsupportedOperationError)
        expect(transport.requests).toHaveLength(0)
    })
})

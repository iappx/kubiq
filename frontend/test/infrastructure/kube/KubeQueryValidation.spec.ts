import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { QueryBuildError, QueryValidationError, QueryOperators, UnsupportedOperationError } from '@iappx/entity-repo-query'
import { KubeFilters, KubeSelectorPath } from '@/domain/entities/kube'
import { PodFilters } from '@/domain/entities/workloads'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'
import { TestKubeContext } from '../../support/TestKubeContext'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create().use(TestKubeContext, transport).getContext(TestKubeContext)

describe('KubeQueryValidation', () => {
    beforeEach(() => {
        transport.reset()
    })

    it('refuses to sort, because the API server returns a list in its own order', async () => {
        await expect(context.pods.orderBy('kind').getAll()).rejects.toThrow(UnsupportedOperationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses to sort by a path', async () => {
        await expect(context.pods.orderByPath(['metadata', 'name']).getAll()).rejects.toThrow(QueryValidationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses a disjunction, which a selector cannot express', async () => {
        const failing = context.pods
            .where(f => f.or(PodFilters.running(f), PodFilters.failed(f)))
            .getAll()

        await expect(failing).rejects.toThrow(QueryValidationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses a negated condition', async () => {
        const failing = context.pods
            .where(f => f.not(KubeFilters.withLabel(f, 'app', 'web')))
            .getAll()

        await expect(failing).rejects.toThrow(QueryValidationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses an operator no Kubernetes selector has', async () => {
        const failing = context.pods
            .where(f => f.opPath(QueryOperators.contains, KubeSelectorPath.namePath(), 'web'))
            .getAll()

        await expect(failing).rejects.toThrow(QueryValidationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses a field selection, which the list endpoint has no notion of', async () => {
        const failing = context.pods
            .select(selection => selection.only('metadata'))
            .getAll()

        await expect(failing).rejects.toThrow(QueryValidationError)
        expect(transport.requests).toHaveLength(0)
    })

    it('refuses an offset, because the API server pages with a continue token', () => {
        expect(() => context.pods.skip(20)).toThrow(QueryBuildError)
        expect(transport.requests).toHaveLength(0)
    })

    it('names every reason at once', async () => {
        const failing = context.pods
            .where(f => f.or(PodFilters.running(f), PodFilters.failed(f)))
            .select(selection => selection.only('metadata'))
            .getAll()

        await expect(failing).rejects.toThrow(/KubeDialect cannot compile the query/)
        expect(transport.requests).toHaveLength(0)
    })
})

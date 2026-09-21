import { describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { KubeFilters } from '@/domain/entities/kube'
import { PodFilters } from '@/domain/entities/workloads'
import { KubeResourceRegistry } from '@/domain/models/kube'
import { KubeEntityContext } from '@/infrastructure/entityRepo/kube/KubeEntityContext'
import { KubeSelectorCompiler } from '@/infrastructure/entityRepo/kube/KubeSelectorCompiler'
import { MemoryKubeTransport } from '../../support/MemoryKubeTransport'

const transport = new MemoryKubeTransport()
const context = EntityRepo.create()
    .use(KubeEntityContext, transport as never)
    .getContext(KubeEntityContext)

const pods = KubeResourceRegistry.find('', 'pods')!

describe('KubeSelectorCompiler', () => {
    it('compiles a field condition into a fieldSelector and leaves labels empty', () => {
        const selectors = KubeSelectorCompiler.compile(context, pods, filter => PodFilters.onNode(filter, 'worker-1'))

        expect(selectors).toEqual({ labelSelector: '', fieldSelector: 'spec.nodeName=worker-1' })
    })

    it('compiles a label condition into a labelSelector', () => {
        const selectors = KubeSelectorCompiler.compile(context, pods, filter => KubeFilters.withLabel(filter, 'app', 'api'))

        expect(selectors).toEqual({ labelSelector: 'app=api', fieldSelector: '' })
    })

    it('keeps each requirement in the parameter it belongs to', () => {
        const selectors = KubeSelectorCompiler.compile(context, pods, filter => filter.and(
            PodFilters.running(filter),
            KubeFilters.withLabel(filter, 'app', 'api'),
        ))

        expect(selectors).toEqual({ labelSelector: 'app=api', fieldSelector: 'status.phase=Running' })
    })
})

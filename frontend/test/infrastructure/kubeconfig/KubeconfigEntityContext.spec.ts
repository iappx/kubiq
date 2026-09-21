import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { KubeconfigEntityQuery } from '@/infrastructure/entityRepo/kubeconfig/KubeconfigEntityQuery'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const FIRST = 'C:/Users/tester/.kube/config'
const SECOND = 'D:/work/kubeconfig.yaml'

let transport: MemoryFileTransport
let provider: EntityRepoProvider

describe('KubeconfigEntityContext', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        transport.files.set(FIRST, KubeconfigFixtures.primary())
        transport.files.set(SECOND, KubeconfigFixtures.secondary())
        provider = new EntityRepoProvider(transport as unknown as FileSystemTransport)
    })

    it('is reachable next to the application context', () => {
        expect(provider.kubeconfig.forFile(FIRST)).toBeInstanceOf(KubeconfigEntityQuery)
        expect(provider.context).toBeDefined()
    })

    it('binds each query to the file it was asked for', async () => {
        const first = await provider.kubeconfig.forFile(FIRST).getAll()
        const second = await provider.kubeconfig.forFile(SECOND).getAll()

        expect(first.map(context => context.name)).toEqual(['prod', 'staging', 'shared'])
        expect(second.map(context => context.name)).toEqual(['prod', 'lab'])
    })

    it('hands out a new query on every access', () => {
        expect(provider.kubeconfig.contexts).not.toBe(provider.kubeconfig.contexts)
    })
})

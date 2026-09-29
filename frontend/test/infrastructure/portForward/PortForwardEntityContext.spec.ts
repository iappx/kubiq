import { beforeEach, describe, expect, it } from 'vitest'
import { PortForwardEntity } from '@/domain/entities/portForward'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileEntityQuery } from '@/infrastructure/entityRepo/queries/FileEntityQuery'
import type { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const FORWARDS_FILE = 'userdata:forwards/port-forwards.json'

let transport: MemoryFileTransport
let provider: EntityRepoProvider

describe('PortForwardEntityContext', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        provider = new EntityRepoProvider(transport as unknown as FileSystemTransport)
    })

    it('keeps the forwards in the user profile', async () => {
        await provider.portForwards.forwards.create(PortForwardEntity.build({
            id: 'pf-1',
            clusterId: 'prod',
            namespace: 'payments',
            resource: 'services',
            name: 'api',
            remotePort: 'http',
            localPort: 0,
            lastLocalPort: 40001,
            restoreMode: 'connectOnStart',
            createdAt: 1,
        }))

        expect(transport.read(FORWARDS_FILE)).toHaveLength(1)

        const [stored] = await provider.portForwards.forwards.getAll()
        expect(stored.remotePort).toBe('http')
        expect(stored.lastLocalPort).toBe(40001)
        expect(stored.restoreMode).toBe('connectOnStart')
    })

    it('reads a missing file as no forwards', async () => {
        await expect(provider.portForwards.forwards.getAll()).resolves.toEqual([])
    })

    it('hands out a new query on every access', () => {
        expect(provider.portForwards.forwards).toBeInstanceOf(FileEntityQuery)
        expect(provider.portForwards.forwards).not.toBe(provider.portForwards.forwards)
    })
})

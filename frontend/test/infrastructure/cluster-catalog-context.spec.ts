import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { KubeconfigSourceEntity } from '@/domain/entities/catalog/KubeconfigSourceEntity'
import { NamespaceSelectionEntity } from '@/domain/entities/catalog/NamespaceSelectionEntity'
import { PinnedClusterEntity } from '@/domain/entities/catalog/PinnedClusterEntity'
import { ClusterCatalogEntityContext } from '@/infrastructure/entityRepo/catalog/ClusterCatalogEntityContext'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../support/MemoryFileTransport'

const PINNED_FILE = 'userdata:clusters/pinned.json'
const SELECTIONS_FILE = 'userdata:clusters/namespaces.json'
const SOURCES_FILE = 'userdata:clusters/kubeconfigs.json'

let transport: MemoryFileTransport
let context: ClusterCatalogEntityContext

describe('ClusterCatalogEntityContext', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        context = EntityRepo.create()
            .use(ClusterCatalogEntityContext, transport as unknown as FileSystemTransport)
            .getContext(ClusterCatalogEntityContext)
    })

    it('keeps each collection in its own file under the user profile', async () => {
        await context.pinned.create(PinnedClusterEntity.build({ contextName: 'prod', pinnedAt: 1 }))
        await context.namespaceSelections.create(
            NamespaceSelectionEntity.build({ contextName: 'prod', namespaces: ['payments'] }),
        )
        await context.kubeconfigSources.create(
            KubeconfigSourceEntity.build({ path: 'D:/work/extra.yaml', addedAt: 2 }),
        )

        expect([...transport.files.keys()].sort()).toEqual([SOURCES_FILE, SELECTIONS_FILE, PINNED_FILE].sort())
    })

    it('reads an entity back with the values it was given', async () => {
        await context.namespaceSelections.create(
            NamespaceSelectionEntity.build({ contextName: 'prod', namespaces: ['api', 'web'] }),
        )

        const stored = await context.namespaceSelections.getById('prod')

        expect(stored?.contextName).toBe('prod')
        expect(stored?.namespaces).toEqual(['api', 'web'])
    })

    it('treats a file that is not there as an empty collection', async () => {
        await expect(context.pinned.getAll()).resolves.toEqual([])
        await expect(context.pinned.getById('prod')).resolves.toBeNull()
    })

    it('replaces a record rather than appending a second one', async () => {
        await context.namespaceSelections.create(
            NamespaceSelectionEntity.build({ contextName: 'prod', namespaces: ['api'] }),
        )

        await context.namespaceSelections.update(
            NamespaceSelectionEntity.build({ contextName: 'prod', namespaces: ['db'] }),
        )

        expect(transport.read(SELECTIONS_FILE)).toEqual([{ contextName: 'prod', namespaces: ['db'] }])
    })

    it('removes one record and keeps the rest', async () => {
        await context.pinned.create(PinnedClusterEntity.build({ contextName: 'prod', pinnedAt: 1 }))
        await context.pinned.create(PinnedClusterEntity.build({ contextName: 'lab', pinnedAt: 2 }))

        await context.pinned.remove('prod')

        expect((await context.pinned.getAll()).map(entity => entity.contextName)).toEqual(['lab'])
    })

    it('drops a hand-edited row with no primary key instead of building half an entity', async () => {
        transport.seed(PINNED_FILE, [{ pinnedAt: 1 }, { contextName: 'lab', pinnedAt: 2 }])

        expect((await context.pinned.getAll()).map(entity => entity.contextName)).toEqual(['lab'])
    })

    it('hands out a fresh query on every access', () => {
        expect(context.pinned).not.toBe(context.pinned)
    })
})

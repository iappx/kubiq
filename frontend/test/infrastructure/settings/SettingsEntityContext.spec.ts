import { beforeEach, describe, expect, it } from 'vitest'
import { EntityRepo } from '@iappx/entity-repo'
import { ClusterSettingsEntity } from '@/domain/entities/settings'
import { SettingsEntityContext } from '@/infrastructure/entityRepo/settings/SettingsEntityContext'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const CLUSTERS_FILE = 'userdata:settings/clusters.json'

const entity = (clusterId: string, prometheusUrl = 'http://prometheus:9090') => ClusterSettingsEntity.build({
    clusterId,
    prometheusSource: 'url',
    prometheusUrl,
    prometheusService: '',
})

let transport: MemoryFileTransport
let context: SettingsEntityContext

describe('SettingsEntityContext', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        context = EntityRepo.create()
            .use(SettingsEntityContext, transport as unknown as FileSystemTransport)
            .getContext(SettingsEntityContext)
    })

    it('keeps per-cluster settings in the user profile', async () => {
        await context.clusters.create(entity('prod'))

        expect([...transport.files.keys()]).toEqual([CLUSTERS_FILE])
    })

    it('treats a missing file as an empty collection', async () => {
        await expect(context.clusters.getAll()).resolves.toEqual([])
        await expect(context.clusters.getById('prod')).resolves.toBeNull()
    })

    it('reads an entity back with the values it was given', async () => {
        await context.clusters.create(entity('prod', 'https://metrics.internal'))

        const stored = await context.clusters.getById('prod')

        expect(stored?.prometheusSource).toBe('url')
        expect(stored?.prometheusUrl).toBe('https://metrics.internal')
    })

    it('replaces a record rather than appending a second one', async () => {
        await context.clusters.create(entity('prod'))
        await context.clusters.update(entity('prod', 'http://other:9090'))

        expect(transport.read(CLUSTERS_FILE)).toEqual([{
            clusterId: 'prod',
            prometheusSource: 'url',
            prometheusUrl: 'http://other:9090',
            prometheusService: '',
        }])
    })

    it('removes one cluster and keeps the rest', async () => {
        await context.clusters.create(entity('prod'))
        await context.clusters.create(entity('lab'))

        await context.clusters.remove('prod')

        expect((await context.clusters.getAll()).map(item => item.clusterId)).toEqual(['lab'])
    })

    it('drops a hand-edited row with no cluster id', async () => {
        transport.seed(CLUSTERS_FILE, [{ prometheusUrl: 'http://prometheus:9090' }, { clusterId: 'lab' }])

        expect((await context.clusters.getAll()).map(item => item.clusterId)).toEqual(['lab'])
    })

    it('hands out a fresh query on every access', () => {
        expect(context.clusters).not.toBe(context.clusters)
    })
})

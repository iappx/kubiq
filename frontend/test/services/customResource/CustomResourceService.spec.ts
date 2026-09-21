import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClusterConnectionService } from '@/application/services/cluster/ClusterConnectionService'
import { CustomResourceService } from '@/application/services/customResource/CustomResourceService'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeColumns, KubeResourceKind, KubeResourceRegistry, KubeVerbCatalog } from '@/domain/models/kube'
import { KubeCrdAdapter } from '@/infrastructure/kube/KubeCrdAdapter'

const widgets = new KubeResourceKind({
    group: 'example.test',
    version: 'v1',
    resource: 'widgets',
    kind: 'Widget',
    title: 'Widget',
    namespaced: true,
    section: 'custom',
    icon: 'Puzzle',
    columns: KubeColumns.baseWithAge(true),
    verbs: KubeVerbCatalog.all(),
    isCustom: true,
})

const definition = {
    spec: {
        group: 'example.test',
        scope: 'Namespaced',
        names: { plural: 'widgets', kind: 'Widget' },
        versions: [
            {
                name: 'v1',
                served: true,
                additionalPrinterColumns: [
                    { name: 'Phase', jsonPath: '.status.phase' },
                    { name: 'Size', jsonPath: '.spec.size', priority: 1 },
                ],
            },
        ],
    },
}

const connectionService = {
    connection: () => ({ sessionId: 'session-1' }),
} as unknown as ClusterConnectionService

const adapterReturning = (answer: unknown) => ({
    read: vi.fn().mockResolvedValue(answer),
}) as unknown as KubeCrdAdapter

const adapterFailing = (error: Error) => ({
    read: vi.fn().mockRejectedValue(error),
}) as unknown as KubeCrdAdapter

describe('CustomResourceService', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('reads one definition by name, never the collection', async () => {
        const adapter = adapterReturning(definition)
        const service = new CustomResourceService(connectionService, adapter)

        await service.printerColumns('prod', widgets)

        expect(adapter.read).toHaveBeenCalledWith('prod', 'session-1', 'widgets.example.test')
    })

    it('replaces the columns with the ones the definition prints', async () => {
        const service = new CustomResourceService(connectionService, adapterReturning(definition))

        const refined = await service.printerColumns('prod', widgets)

        expect(refined?.columns.map(column => column.key)).toEqual(['name', 'namespace', 'Phase', 'Size'])
        expect(refined?.columns[2].jsonPath).toBe('.status.phase')
        expect(refined?.columns[3].priority).toBe(1)
        expect(refined?.verbs).toEqual(widgets.verbs)
    })

    it('leaves a built-in kind alone', async () => {
        const service = new CustomResourceService(connectionService, adapterReturning(definition))
        const pods = KubeResourceRegistry.find('', 'pods')!

        expect(CustomResourceService.definesColumns(pods)).toBe(false)
        expect(await service.printerColumns('prod', pods)).toBeNull()
    })

    it('answers null when the cluster refuses or has no such definition', async () => {
        const forbidden = new CustomResourceService(connectionService, adapterFailing(new ApiError('no', 'no', 403)))
        const missing = new CustomResourceService(connectionService, adapterFailing(new ApiError('no', 'no', 404)))

        expect(await forbidden.printerColumns('prod', widgets)).toBeNull()
        expect(await missing.printerColumns('prod', widgets)).toBeNull()
    })

    it('lets a real fault through rather than hiding it', async () => {
        const service = new CustomResourceService(connectionService, adapterFailing(new ApiError('boom', 'boom', 500)))

        await expect(service.printerColumns('prod', widgets)).rejects.toThrow('boom')
    })

    it('answers null without a session', async () => {
        const offline = { connection: () => null } as unknown as ClusterConnectionService
        const service = new CustomResourceService(offline, adapterReturning(definition))

        expect(await service.printerColumns('prod', widgets)).toBeNull()
    })
})

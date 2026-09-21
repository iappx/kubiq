import { beforeEach, describe, expect, it, vi } from 'vitest'

const variables: Record<string, string> = {}

vi.mock('../../../bindings/iappx_k8s_admin/core/services/env', () => ({
    EnvService: {
        Get: (name: string) => Promise.resolve(
            name in variables
                ? { success: true, value: variables[name] }
                : { success: false, value: '', error: 'environment variable is not set' },
        ),
        UserHomeDir: () => Promise.resolve({ success: true, value: 'C:/Users/tester' }),
        PathSeparator: () => Promise.resolve({ success: true, value: ';' }),
        Expand: (path: string) => Promise.resolve({ success: true, value: path }),
    },
}))

import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const HOME_CONFIG = 'C:/Users/tester/.kube/config'
const WORK_CONFIG = 'D:/work/kubeconfig.yaml'
const PINNED_FILE = 'userdata:clusters/pinned.json'
const SOURCES_FILE = 'userdata:clusters/kubeconfigs.json'

const runtime = { isAvailable: () => true } as WailsRuntimeService

let transport: MemoryFileTransport
let service: ClusterCatalogService

describe('ClusterCatalogService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        variables.KUBECONFIG = HOME_CONFIG
        transport = new MemoryFileTransport()
        transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())

        const repoProvider = new EntityRepoProvider(transport as unknown as FileSystemTransport)
        service = new ClusterCatalogService(
            repoProvider,
            new KubeconfigService(new EnvironmentAdapter(runtime), repoProvider),
        )
    })

    describe('pinned clusters', () => {
        it('keeps pins in the user profile rather than beside the binary', async () => {
            await service.pin('prod', 10)

            expect([...transport.files.keys()]).toContain(PINNED_FILE)
            expect(transport.read(PINNED_FILE)).toEqual([{ contextName: 'prod', pinnedAt: 10 }])
        })

        it('answers an empty list on a first run', async () => {
            await expect(service.getPinned()).resolves.toEqual([])
        })

        it('reports pins oldest first so the strip does not reshuffle', async () => {
            await service.pin('lab', 30)
            await service.pin('prod', 10)
            await service.pin('staging', 20)

            await expect(service.getPinned()).resolves.toEqual(['prod', 'staging', 'lab'])
        })

        it('pinning twice changes nothing', async () => {
            await service.pin('prod', 10)
            await service.pin('prod', 99)

            await expect(service.getPinned()).resolves.toEqual(['prod'])
            expect(transport.read(PINNED_FILE)).toEqual([{ contextName: 'prod', pinnedAt: 10 }])
        })

        it('unpins one without touching the others', async () => {
            await service.pin('prod', 10)
            await service.pin('lab', 20)

            await service.unpin('prod')

            await expect(service.getPinned()).resolves.toEqual(['lab'])
        })
    })

    describe('kubeconfig files added by hand', () => {
        it('takes a file that holds contexts and remembers it', async () => {
            await expect(service.addSource(WORK_CONFIG, 5)).resolves.toBe(WORK_CONFIG)

            await expect(service.getSources()).resolves.toEqual([WORK_CONFIG])
            expect(transport.read(SOURCES_FILE)).toEqual([{ path: WORK_CONFIG, addedAt: 5 }])
        })

        it('refuses an empty path', async () => {
            await expect(service.addSource('   ', 5)).rejects.toBeInstanceOf(ApiError)
        })

        it('refuses a file that holds no contexts', async () => {
            transport.files.set('D:/work/empty.yaml', 'apiVersion: v1\nkind: Config\n')

            const failure = await service.addSource('D:/work/empty.yaml', 5).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toContain('no kubeconfig contexts')
            await expect(service.getSources()).resolves.toEqual([])
        })

        it('refuses a file that is not there', async () => {
            await expect(service.addSource('D:/work/missing.yaml', 5)).rejects.toBeInstanceOf(ApiError)
        })

        it('refuses the same file twice', async () => {
            await service.addSource(WORK_CONFIG, 5)

            const failure = await service.addSource(WORK_CONFIG, 6).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toContain('already in the catalog')
        })

        it('reports the files in the order they were added', async () => {
            transport.files.set('D:/work/second.yaml', KubeconfigFixtures.withoutCurrentContext())

            await service.addSource('D:/work/second.yaml', 20)
            await service.addSource(WORK_CONFIG, 10)

            await expect(service.getSources()).resolves.toEqual([WORK_CONFIG, 'D:/work/second.yaml'])
        })

        it('removes a file from the catalog without touching it on disk', async () => {
            await service.addSource(WORK_CONFIG, 5)

            await service.removeSource(WORK_CONFIG)

            await expect(service.getSources()).resolves.toEqual([])
            expect(transport.files.has(WORK_CONFIG)).toBe(true)
        })
    })
})

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
import { KubeconfigImportService } from '@/application/services/kubeconfigImport/KubeconfigImportService'
import { ApiError } from '@/domain/errors/ApiError'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'
import { KubeconfigFixtures } from '../../support/fixtures/KubeconfigFixtures'

const HOME_CONFIG = 'C:/Users/tester/.kube/config'
const WORK_CONFIG = 'D:/work/kubeconfig.yaml'
const SAVED_CONFIG = 'C:/Users/tester/AppData/Roaming/kubiq/kubeconfigs/lab-9f2.yaml'
const PINNED_FILE = 'userdata:clusters/pinned.json'
const SOURCES_FILE = 'userdata:clusters/kubeconfigs.json'

const runtime = { isAvailable: () => true } as WailsRuntimeService
const host = { absolutePath: async (path: string) => path } as HostShellAdapter

let transport: MemoryFileTransport
let service: ClusterCatalogService

describe('ClusterCatalogService', () => {
    beforeEach(() => {
        Object.keys(variables).forEach(key => delete variables[key])
        variables.KUBECONFIG = HOME_CONFIG
        transport = new MemoryFileTransport()
        transport.files.set(HOME_CONFIG, KubeconfigFixtures.primary())
        transport.files.set(WORK_CONFIG, KubeconfigFixtures.secondary())
        transport.files.set(SAVED_CONFIG, KubeconfigFixtures.secondary())

        const repoProvider = new EntityRepoProvider(transport as unknown as FileSystemTransport)
        service = new ClusterCatalogService(
            repoProvider,
            new KubeconfigService(new EnvironmentAdapter(runtime), repoProvider),
            new KubeconfigImportService(transport as unknown as FileSystemTransport, host),
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
            await expect(service.addSource(WORK_CONFIG, 'file', 5)).resolves.toBe(WORK_CONFIG)

            await expect(service.getSourcePaths()).resolves.toEqual([WORK_CONFIG])
            expect(transport.read(SOURCES_FILE)).toEqual([{ path: WORK_CONFIG, addedAt: 5, origin: 'file' }])
        })

        it('refuses an empty path', async () => {
            await expect(service.addSource('   ', 'file', 5)).rejects.toBeInstanceOf(ApiError)
        })

        it('refuses a file that holds no contexts', async () => {
            transport.files.set('D:/work/empty.yaml', 'apiVersion: v1\nkind: Config\n')

            const failure = await service.addSource('D:/work/empty.yaml', 'file', 5).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toContain('no kubeconfig contexts')
            await expect(service.getSourcePaths()).resolves.toEqual([])
        })

        it('refuses a file that is not there', async () => {
            await expect(service.addSource('D:/work/missing.yaml', 'file', 5)).rejects.toBeInstanceOf(ApiError)
        })

        it('refuses the same file twice', async () => {
            await service.addSource(WORK_CONFIG, 'file', 5)

            const failure = await service.addSource(WORK_CONFIG, 'file', 6).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toContain('already in the catalog')
        })

        it('reports the files in the order they were added', async () => {
            transport.files.set('D:/work/second.yaml', KubeconfigFixtures.withoutCurrentContext())

            await service.addSource('D:/work/second.yaml', 'file', 20)
            await service.addSource(WORK_CONFIG, 'file', 10)

            await expect(service.getSourcePaths()).resolves.toEqual([WORK_CONFIG, 'D:/work/second.yaml'])
        })

        it('reports how each file got into the catalog', async () => {
            await service.addSource(WORK_CONFIG, 'file', 10)
            await service.addSource(SAVED_CONFIG, 'paste', 20)

            await expect(service.getSources()).resolves.toEqual([
                { path: WORK_CONFIG, origin: 'file' },
                { path: SAVED_CONFIG, origin: 'paste' },
            ])
        })

        it('reads a catalogue written before origins were recorded as files of the operator', async () => {
            transport.seed(SOURCES_FILE, [{ path: WORK_CONFIG, addedAt: 5 }])

            await expect(service.getSources()).resolves.toEqual([{ path: WORK_CONFIG, origin: 'file' }])
        })
    })

    describe('removing a kubeconfig', () => {
        it('removes a file the operator named without touching it on disk', async () => {
            await service.addSource(WORK_CONFIG, 'file', 5)

            await expect(service.removeSource(WORK_CONFIG)).resolves.toBe(false)

            await expect(service.getSourcePaths()).resolves.toEqual([])
            expect(transport.files.has(WORK_CONFIG)).toBe(true)
        })

        it('deletes the config it saved from a paste', async () => {
            await service.addSource(SAVED_CONFIG, 'paste', 5)

            await expect(service.removeSource(SAVED_CONFIG)).resolves.toBe(true)

            await expect(service.getSourcePaths()).resolves.toEqual([])
            expect(transport.files.has(SAVED_CONFIG)).toBe(false)
        })

        it('leaves a config written before origins were recorded alone', async () => {
            transport.seed(SOURCES_FILE, [{ path: SAVED_CONFIG, addedAt: 5 }])

            await expect(service.removeSource(SAVED_CONFIG)).resolves.toBe(false)
            expect(transport.files.has(SAVED_CONFIG)).toBe(true)
        })

        it('drops the pins of the clusters that go with it', async () => {
            await service.addSource(WORK_CONFIG, 'file', 5)
            await service.pin('staging', 10)
            await service.pin('prod', 20)

            await service.removeSource(WORK_CONFIG, ['staging', 'lab'])

            await expect(service.getPinned()).resolves.toEqual(['prod'])
        })
    })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { SettingsMigrations } from '@/application/services/settings/constants/SettingsMigrations'
import type { TSettingsMigration } from '@/application/services/settings/types/TSettingsMigration'
import { ClusterSettingsEntity } from '@/domain/entities/settings'
import { AppSettings } from '@/domain/models/settings'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { AppSettingsAdapter } from '@/infrastructure/settings/AppSettingsAdapter'
import { SettingsSchemaAdapter } from '@/infrastructure/settings/SettingsSchemaAdapter'
import { AppStorageAdapter } from '@/infrastructure/storage/AppStorageAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { MemoryFileTransport } from '../../support/MemoryFileTransport'

const SETTINGS_FILE = 'userdata:settings/app.json'
const SCHEMA_FILE = 'userdata:settings/schema.json'
const CLUSTERS_FILE = 'userdata:settings/clusters.json'

const offline = { isAvailable: () => false } as WailsRuntimeService

let transport: MemoryFileTransport
let service: SettingsService

const build = (): SettingsService => {
    const fileSystem = transport as unknown as FileSystemTransport

    return new SettingsService(
        new AppSettingsAdapter(fileSystem),
        new SettingsSchemaAdapter(fileSystem),
        new AppStorageAdapter(offline),
        new EntityRepoProvider(fileSystem),
    )
}

describe('SettingsService', () => {
    beforeEach(() => {
        transport = new MemoryFileTransport()
        service = build()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('application settings', () => {
        it('answers the defaults on a first run without writing anything', async () => {
            await expect(service.read()).resolves.toEqual(AppSettings.defaults())
            expect(transport.writes).toBe(0)
        })

        it('answers the defaults when the file was corrupted rather than failing', async () => {
            transport.files.set(SETTINGS_FILE, '{ "kubectlPath": ')

            await expect(service.read()).resolves.toEqual(AppSettings.defaults())
        })

        it('stores what it was given and reads it back', async () => {
            await service.save({
                kubectlPath: 'C:/tools/kubectl.exe',
                helmPath: 'C:/tools/helm.exe',
                nodeShellImage: 'registry.internal/shell:1',
            })

            const stored = await build().read()

            expect(stored.kubectlPath).toBe('C:/tools/kubectl.exe')
            expect(stored.helmPath).toBe('C:/tools/helm.exe')
            expect(stored.nodeShellImage).toBe('registry.internal/shell:1')
        })

        it('writes the settings to the user profile', async () => {
            await service.save(AppSettings.defaults())

            expect([...transport.files.keys()]).toEqual([SETTINGS_FILE])
        })

        it('reports an unset tool path as empty so the caller falls back to PATH', async () => {
            await expect(service.kubectlPath()).resolves.toBe('')
            await expect(service.helmPath()).resolves.toBe('')
        })

        it('reports the chosen tool paths once they are stored', async () => {
            await service.save({ ...AppSettings.defaults(), kubectlPath: '/usr/bin/kubectl', helmPath: '/usr/bin/helm' })

            await expect(service.kubectlPath()).resolves.toBe('/usr/bin/kubectl')
            await expect(service.helmPath()).resolves.toBe('/usr/bin/helm')
        })

        it('always answers a node shell image, its own when none was chosen', async () => {
            await expect(service.nodeShellImage()).resolves.toBe(AppSettings.DefaultNodeShellImage)

            await service.save({ ...AppSettings.defaults(), nodeShellImage: 'registry.internal/shell:2' })

            await expect(service.nodeShellImage()).resolves.toBe('registry.internal/shell:2')
        })

    })

    describe('per-cluster settings', () => {
        it('answers nothing for a cluster that was never configured', async () => {
            await expect(service.clusterSettings('prod')).resolves.toBeNull()
            await expect(service.listClusters()).resolves.toEqual([])
        })

        it('stores a Prometheus address against the cluster', async () => {
            await service.saveClusterSettings({
                clusterId: 'prod',
                prometheusSource: 'url',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack',
            })

            await expect(service.clusterSettings('prod')).resolves.toEqual({
                clusterId: 'prod',
                prometheusSource: 'url',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack',
            })
        })

        it('updates a cluster in place rather than storing it twice', async () => {
            const draft = {
                clusterId: 'prod',
                prometheusSource: 'url' as const,
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: '',
                prometheusLayout: 'victoriaMetrics' as const,
            }

            await service.saveClusterSettings(draft)
            await service.saveClusterSettings({ ...draft, prometheusUrl: 'http://metrics:9090' })

            const stored = await service.listClusters()

            expect(stored).toHaveLength(1)
            expect(stored[0].prometheusUrl).toBe('http://metrics:9090')
        })

        it('drops the address when the source moved to an in-cluster service', async () => {
            await service.saveClusterSettings({
                clusterId: 'prod',
                prometheusSource: 'service',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: 'monitoring/prometheus:9090',
                prometheusLayout: 'kubePrometheusStack',
            })

            await expect(service.clusterSettings('prod')).resolves.toEqual({
                clusterId: 'prod',
                prometheusSource: 'service',
                prometheusUrl: '',
                prometheusService: 'monitoring/prometheus:9090',
                prometheusLayout: 'kubePrometheusStack',
            })
        })

        it('keeps neither target when the source is switched off', async () => {
            await service.saveClusterSettings({
                clusterId: 'prod',
                prometheusSource: 'none',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: 'monitoring/prometheus:9090',
                prometheusLayout: 'kubePrometheusStack',
            })

            const stored = await service.clusterSettings('prod')

            expect(stored?.prometheusUrl).toBe('')
            expect(stored?.prometheusService).toBe('')
        })

        it('reads a hand-edited source it does not know as unconfigured', async () => {
            transport.seed(CLUSTERS_FILE, [{ clusterId: 'prod', prometheusSource: 'thanos', prometheusUrl: 'http://x' }])

            await expect(service.clusterSettings('prod')).resolves.toEqual({
                clusterId: 'prod',
                prometheusSource: 'none',
                prometheusUrl: '',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack',
            })
        })

        it('lists the clusters in a stable order', async () => {
            const draft = {
                prometheusSource: 'none' as const,
                prometheusUrl: '',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack' as const,
            }

            await service.saveClusterSettings({ ...draft, clusterId: 'prod' })
            await service.saveClusterSettings({ ...draft, clusterId: 'lab' })
            await service.saveClusterSettings({ ...draft, clusterId: 'dev' })

            expect((await service.listClusters()).map(item => item.clusterId)).toEqual(['dev', 'lab', 'prod'])
        })

        it('removes one cluster and leaves the others alone', async () => {
            const draft = {
                prometheusSource: 'none' as const,
                prometheusUrl: '',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack' as const,
            }

            await service.saveClusterSettings({ ...draft, clusterId: 'prod' })
            await service.saveClusterSettings({ ...draft, clusterId: 'lab' })

            await service.removeClusterSettings('prod')

            expect((await service.listClusters()).map(item => item.clusterId)).toEqual(['lab'])
        })

        it('stores a cluster through the entity, so the file holds only its fields', async () => {
            await service.saveClusterSettings({
                clusterId: 'prod',
                prometheusSource: 'url',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack',
            })

            expect(transport.read(CLUSTERS_FILE)).toEqual([{
                clusterId: 'prod',
                prometheusSource: 'url',
                prometheusUrl: 'http://prometheus:9090',
                prometheusService: '',
                prometheusLayout: 'kubePrometheusStack',
            }])
        })
    })

    describe('format version and migration', () => {
        it('stamps a fresh profile with the current version', async () => {
            await expect(service.migrate()).resolves.toBe(SettingsMigrations.CurrentVersion)
            expect(transport.read(SCHEMA_FILE)).toEqual({ version: SettingsMigrations.CurrentVersion })
        })

        it('writes nothing when the profile is already current', async () => {
            await service.migrate()
            const writes = transport.writes

            await build().migrate()

            expect(transport.writes).toBe(writes)
        })

        it('runs the steps newer than the stamp, oldest first', async () => {
            const applied: number[] = []
            vi.spyOn(SettingsMigrations, 'all').mockReturnValue([
                { to: 3, apply: async () => { applied.push(3) } },
                { to: 1, apply: async () => { applied.push(1) } },
                { to: 2, apply: async () => { applied.push(2) } },
            ] as TSettingsMigration[])
            await new SettingsSchemaAdapter(transport as unknown as FileSystemTransport).write(1)

            await expect(build().migrate()).resolves.toBe(3)
            expect(applied).toEqual([2, 3])
        })

        it('stamps after every step, so an interrupted run resumes where it stopped', async () => {
            const stamps: number[] = []
            vi.spyOn(SettingsMigrations, 'all').mockReturnValue([
                { to: 1, apply: async () => { stamps.push(transport.read(SCHEMA_FILE)?.version ?? 0) } },
                { to: 2, apply: async () => { stamps.push(transport.read(SCHEMA_FILE)?.version ?? 0) } },
            ] as TSettingsMigration[])

            await build().migrate()

            expect(stamps).toEqual([0, 1])
        })

        it('hands a step the settings collections it has to migrate', async () => {
            vi.spyOn(SettingsMigrations, 'all').mockReturnValue([{
                to: 2,
                apply: target => target.collections.clusters.create(ClusterSettingsEntity.build({
                    clusterId: 'prod',
                    prometheusSource: 'none',
                    prometheusUrl: '',
                    prometheusService: '',
                })).then(() => undefined),
            }] as TSettingsMigration[])

            await build().migrate()

            expect((await service.listClusters()).map(item => item.clusterId)).toEqual(['prod'])
        })

        it('replays the history from zero when the stamp is unreadable', async () => {
            const applied: number[] = []
            vi.spyOn(SettingsMigrations, 'all').mockReturnValue([
                { to: 1, apply: async () => { applied.push(1) } },
            ] as TSettingsMigration[])
            transport.files.set(SCHEMA_FILE, 'not json')

            await build().migrate()

            expect(applied).toEqual([1])
        })

        it('leaves a profile written by a newer build alone', async () => {
            await new SettingsSchemaAdapter(transport as unknown as FileSystemTransport).write(99)

            await expect(build().migrate()).resolves.toBe(99)
            expect(transport.read(SCHEMA_FILE)).toEqual({ version: 99 })
        })

        it('reports the stored version without migrating', async () => {
            await expect(service.schemaVersion()).resolves.toBe(0)
        })

        it('stamps a metric layout onto rows saved before the field existed', async () => {
            transport.seed(CLUSTERS_FILE, [
                { clusterId: 'prod', prometheusSource: 'service', prometheusService: 'obs/prom:9090' },
            ])

            await service.migrate()

            await expect(service.clusterSettings('prod')).resolves.toMatchObject({
                prometheusLayout: 'kubePrometheusStack',
            })
        })

        // The stamp can be lost, and the whole history is then replayed from zero.
        it('leaves a row that already names a layout untouched', async () => {
            transport.seed(CLUSTERS_FILE, [
                {
                    clusterId: 'prod',
                    prometheusSource: 'service',
                    prometheusService: 'obs/prom:9090',
                    prometheusLayout: 'victoriaMetrics',
                },
            ])

            await service.migrate()
            const writes = transport.writes
            transport.files.set(SCHEMA_FILE, 'not json')
            await build().migrate()

            await expect(service.clusterSettings('prod')).resolves.toMatchObject({
                prometheusLayout: 'victoriaMetrics',
            })
            expect(transport.writes).toBe(writes + 1)
        })
    })

    describe('storage outside a desktop host', () => {
        it('reports no paths and never raises', async () => {
            await expect(service.storageInfo()).resolves.toEqual({ root: '', logs: '', version: 0 })
        })

        it('does nothing when asked to open the log folder', async () => {
            await expect(service.openLogFolder()).resolves.toBeUndefined()
        })
    })
})

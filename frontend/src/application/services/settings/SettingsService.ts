import { inject, injectable } from 'tsyringe'
import { SettingsMigrations } from '@/application/services/settings/constants/SettingsMigrations'
import { SettingsMigrationPlan } from '@/application/services/settings/models/SettingsMigrationPlan'
import type { TSettingsMigrationTarget } from '@/application/services/settings/types/TSettingsMigrationTarget'
import { ClusterSettingsEntity } from '@/domain/entities/settings/ClusterSettingsEntity'
import { PrometheusSourceCatalog } from '@/domain/entities/settings/PrometheusSourceCatalog'
import type { TClusterSettingsDraft } from '@/domain/entities/settings/types/TClusterSettingsDraft'
import { PrometheusLayoutCatalog } from '@/domain/models/metrics'
import { AppSettings } from '@/domain/models/settings/AppSettings'
import type { TAppSettings } from '@/domain/models/settings/types/TAppSettings'
import type { TStorageInfo } from '@/domain/models/settings/types/TStorageInfo'
import { EntityRepoProvider } from '@/infrastructure/entityRepo/EntityRepoProvider'
import { AppSettingsAdapter } from '@/infrastructure/settings/AppSettingsAdapter'
import { SettingsSchemaAdapter } from '@/infrastructure/settings/SettingsSchemaAdapter'
import { AppStorageAdapter } from '@/infrastructure/storage/AppStorageAdapter'

@injectable()
export class SettingsService {
    constructor(
        @inject(AppSettingsAdapter) private readonly document: AppSettingsAdapter,
        @inject(SettingsSchemaAdapter) private readonly schema: SettingsSchemaAdapter,
        @inject(AppStorageAdapter) private readonly storage: AppStorageAdapter,
        @inject(EntityRepoProvider) private readonly repoProvider: EntityRepoProvider,
    ) {}

    public async read(): Promise<TAppSettings> {
        return AppSettings.parse(await this.document.read())
    }

    public async save(settings: TAppSettings): Promise<TAppSettings> {
        const stored = AppSettings.parse(settings)
        await this.document.write(AppSettings.serialize(stored))

        return stored
    }

    public async kubectlPath(): Promise<string> {
        return (await this.read()).kubectlPath
    }

    public async helmPath(): Promise<string> {
        return (await this.read()).helmPath
    }

    public async nodeShellImage(): Promise<string> {
        return AppSettings.nodeShellImageOf(await this.read())
    }

    public async listClusters(): Promise<TClusterSettingsDraft[]> {
        const stored = await this.repoProvider.settings.clusters.getAll()

        return stored
            .map(entity => SettingsService.toDraft(entity))
            .sort((left, right) => left.clusterId.localeCompare(right.clusterId))
    }

    public async clusterSettings(clusterId: string): Promise<TClusterSettingsDraft | null> {
        const stored = await this.repoProvider.settings.clusters.getById(clusterId)

        return stored ? SettingsService.toDraft(stored) : null
    }

    public async saveClusterSettings(draft: TClusterSettingsDraft): Promise<TClusterSettingsDraft> {
        const normalised = SettingsService.normalise(draft)
        const entity = ClusterSettingsEntity.build(normalised)

        if (await this.repoProvider.settings.clusters.getById(normalised.clusterId)) {
            await this.repoProvider.settings.clusters.update(entity)
        } else {
            await this.repoProvider.settings.clusters.create(entity)
        }

        return normalised
    }

    public removeClusterSettings(clusterId: string): Promise<void> {
        return this.repoProvider.settings.clusters.remove(clusterId)
    }

    public async migrate(): Promise<number> {
        const steps = SettingsMigrations.all()
        const from = await this.schema.read()
        const target = SettingsMigrationPlan.targetVersion(from, steps, SettingsMigrations.CurrentVersion)

        let version = from
        for (const step of SettingsMigrationPlan.pending(from, steps)) {
            await step.apply(this.target())
            version = step.to
            await this.schema.write(version)
        }

        if (version !== target) {
            version = target
            await this.schema.write(version)
        }

        return version
    }

    public schemaVersion(): Promise<number> {
        return this.schema.read()
    }

    public storageInfo(): Promise<TStorageInfo> {
        return this.storage.info()
    }

    public openLogFolder(): Promise<void> {
        return this.storage.openLogFolder()
    }

    private target(): TSettingsMigrationTarget {
        return { collections: this.repoProvider.settings, document: this.document }
    }

    private static toDraft(entity: ClusterSettingsEntity): TClusterSettingsDraft {
        return SettingsService.normalise({
            clusterId: entity.clusterId,
            prometheusSource: entity.prometheusSource,
            prometheusUrl: entity.prometheusUrl,
            prometheusService: entity.prometheusService,
            prometheusLayout: entity.prometheusLayout,
        })
    }

    private static normalise(draft: Partial<TClusterSettingsDraft>): TClusterSettingsDraft {
        const source = PrometheusSourceCatalog.parse(draft.prometheusSource)

        return {
            clusterId: (draft.clusterId ?? '').trim(),
            prometheusSource: source,
            prometheusUrl: source === 'url' ? (draft.prometheusUrl ?? '').trim() : '',
            prometheusService: source === 'service' ? (draft.prometheusService ?? '').trim() : '',
            prometheusLayout: PrometheusLayoutCatalog.parse(draft.prometheusLayout),
        }
    }
}

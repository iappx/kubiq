import { inject, singleton } from 'tsyringe'
import { ClusterCatalogService } from '@/application/services/clusterCatalog/ClusterCatalogService'
import { ExecutableService } from '@/application/services/executable/ExecutableService'
import type { TExecutableLocation } from '@/application/services/executable/types/TExecutableLocation'
import { HelmLimits } from '@/application/services/helm/constants/HelmLimits'
import { HelmManifestReader } from '@/application/services/helm/models/HelmManifestReader'
import { HelmOperationPlan } from '@/application/services/helm/models/HelmOperationPlan'
import { HelmOperationSession } from '@/application/services/helm/models/HelmOperationSession'
import type { IHelmOperationSink } from '@/application/services/helm/types/IHelmOperationSink'
import type { THelmManifestResource } from '@/application/services/helm/types/THelmManifestResource'
import type { THelmReleaseFilter } from '@/application/services/helm/types/THelmReleaseFilter'
import { KubeconfigService } from '@/application/services/kubeconfig/KubeconfigService'
import { SettingsService } from '@/application/services/settings/SettingsService'
import { HelmChartEntity } from '@/domain/entities/helm/HelmChartEntity'
import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import { HelmRepositoryEntity } from '@/domain/entities/helm/HelmRepositoryEntity'
import { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'
import type { THelmInstallDraft } from '@/domain/entities/helm/types/THelmInstallDraft'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import type { THelmRepositoryDraft } from '@/domain/entities/helm/types/THelmRepositoryDraft'
import type { THelmUpgradeDraft } from '@/domain/entities/helm/types/THelmUpgradeDraft'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmDocs } from '@/domain/models/helm/HelmDocs'
import type { THelmAvailability } from '@/domain/models/helm/types/THelmAvailability'
import type { THelmEnvironment } from '@/domain/models/helm/types/THelmEnvironment'
import { HelmContextProvider } from '@/infrastructure/entityRepo/helm/HelmContextProvider'
import { HelmQueryMeta } from '@/infrastructure/entityRepo/helm/HelmQueryMeta'
import type { HelmEntityContext } from '@/infrastructure/entityRepo/helm/HelmEntityContext'
import type { THelmStreamRequest } from '@/infrastructure/entityRepo/helm/transport/types/THelmStreamRequest'
import { EnvironmentAdapter } from '@/infrastructure/env/EnvironmentAdapter'
import { HelmVersionAdapter } from '@/infrastructure/helm/HelmVersionAdapter'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

@singleton()
export class HelmService {
    private readonly probes = new Map<string, THelmAvailability>()

    private readonly operations = new Map<string, HelmOperationSession>()

    constructor(
        @inject(SettingsService) private readonly settingsService: SettingsService,
        @inject(ExecutableService) private readonly executableService: ExecutableService,
        @inject(KubeconfigService) private readonly kubeconfigService: KubeconfigService,
        @inject(ClusterCatalogService) private readonly catalogService: ClusterCatalogService,
        @inject(EnvironmentAdapter) private readonly environment: EnvironmentAdapter,
        @inject(HelmVersionAdapter) private readonly versions: HelmVersionAdapter,
        @inject(HelmContextProvider) private readonly contexts: HelmContextProvider,
        @inject(HostShellAdapter) private readonly host: HostShellAdapter,
    ) {}

    public async environmentOf(clusterId: string): Promise<THelmEnvironment> {
        const location = await this.locate()
        const sources = await this.catalogService.getSources()
        const files = await this.kubeconfigService.locate(sources)
        const separator = await this.environment.pathListSeparator()

        return {
            // A found path wins, but the bare name stays as the fallback: the Go side
            // looks PATH up itself and may succeed where our own scan came up empty.
            executable: location.path === '' ? HelmCommand.executable : location.path,
            contextName: clusterId,
            kubeconfig: files.join(separator || ':'),
        }
    }

    public async availability(clusterId: string, refresh: boolean = false): Promise<THelmAvailability> {
        const location = await this.locate()
        const environment = await this.environmentOf(clusterId)
        const known = this.probes.get(environment.executable)
        if (known && !refresh) {
            return known
        }

        const probed = await this.versions.read(environment.executable)
        // The "nowhere to be found" wording is only honest when nothing answered at all:
        // a helm that ran and reported a version keeps the reason the probe wrote.
        const answer = probed.available || probed.version !== '' || location.source !== 'none'
            ? probed
            : { ...probed, reason: HelmService.notFound(location.name) }

        this.probes.set(environment.executable, answer)

        return answer
    }

    public openInstallGuide(): Promise<void> {
        return this.host.openUri(HelmDocs.installUrl)
    }

    private async locate(): Promise<TExecutableLocation> {
        return this.executableService.locate(HelmCommand.executable, await this.settingsService.helmPath())
    }

    private static notFound(name: string): string {
        return `"${name}" is neither on PATH nor at the path set in Settings`
    }

    public forget(clusterId: string): void {
        this.contexts.release(clusterId)
    }

    public forgetProbes(): void {
        this.probes.clear()
    }

    public async listReleases(clusterId: string, filter: THelmReleaseFilter): Promise<HelmReleaseEntity[]> {
        const context = await this.context(clusterId)
        let query = context.releases
            .orderBy('updated', 'desc')
            .take(HelmLimits.maxReleases)

        if (filter.namespace !== '') {
            query = query.andWhere(condition => condition.eq('namespace', filter.namespace))
        }
        if (filter.search !== '') {
            query = query.andWhere(condition => condition.contains('name', filter.search))
        }
        if (filter.includeSuperseded) {
            query = query.withMeta(HelmQueryMeta.withSuperseded())
        }

        return query.getAll()
    }

    public async values(clusterId: string, ref: THelmReleaseRef, computed: boolean): Promise<string> {
        return (await this.context(clusterId)).releases.valuesOf(ref, computed)
    }

    public async manifest(clusterId: string, ref: THelmReleaseRef): Promise<string> {
        return (await this.context(clusterId)).releases.manifest(ref)
    }

    public async notes(clusterId: string, ref: THelmReleaseRef): Promise<string> {
        return (await this.context(clusterId)).releases.notes(ref)
    }

    public resourcesOf(manifest: string, namespace: string): THelmManifestResource[] {
        return HelmManifestReader.resources(manifest, namespace)
    }

    public async history(clusterId: string, ref: THelmReleaseRef): Promise<HelmRevisionEntity[]> {
        return (await this.context(clusterId)).historyOf(ref.name, ref.namespace).getAll()
    }

    public async repositories(clusterId: string): Promise<HelmRepositoryEntity[]> {
        return (await this.context(clusterId)).repositories.getAll()
    }

    public async addRepository(clusterId: string, draft: THelmRepositoryDraft): Promise<void> {
        const context = await this.context(clusterId)
        await context.repositories.create(HelmRepositoryEntity.build({ ...draft }))
    }

    public async removeRepository(clusterId: string, name: string): Promise<void> {
        await (await this.context(clusterId)).repositories.remove(name)
    }

    public async updateRepositories(clusterId: string): Promise<void> {
        await (await this.context(clusterId)).repositories.refresh()
    }

    public async searchCharts(
        clusterId: string,
        keyword: string,
        repoName: string,
        allVersions: boolean,
    ): Promise<HelmChartEntity[]> {
        const context = await this.context(clusterId)
        let query = context.charts

        if (repoName !== '') {
            query = query.andWhere(condition => condition.eq('repoName', repoName))
        }
        if (keyword !== '') {
            query = query.andWhere(condition => condition.contains('chartName', keyword))
        }
        if (allVersions) {
            query = query.withMeta(HelmQueryMeta.withAllVersions())
        }

        return query.getAll()
    }

    public async chartReadme(clusterId: string, ref: string, version: string): Promise<string> {
        return (await this.context(clusterId)).charts.readme(ref, version)
    }

    public async chartValues(clusterId: string, ref: string, version: string): Promise<string> {
        return (await this.context(clusterId)).charts.defaultValues(ref, version)
    }

    public install(clusterId: string, key: string, draft: THelmInstallDraft, sink: IHelmOperationSink): Promise<void> {
        return this.run(clusterId, key, HelmOperationPlan.install(draft), sink)
    }

    public upgrade(clusterId: string, key: string, draft: THelmUpgradeDraft, sink: IHelmOperationSink): Promise<void> {
        return this.run(clusterId, key, HelmOperationPlan.upgrade(draft), sink)
    }

    public uninstall(
        clusterId: string,
        key: string,
        ref: THelmReleaseRef,
        keepHistory: boolean,
        sink: IHelmOperationSink,
    ): Promise<void> {
        return this.run(clusterId, key, HelmOperationPlan.uninstall(ref, keepHistory), sink)
    }

    public rollback(
        clusterId: string,
        key: string,
        ref: THelmReleaseRef,
        revision: number,
        sink: IHelmOperationSink,
    ): Promise<void> {
        return this.run(clusterId, key, HelmOperationPlan.rollback(ref, revision), sink)
    }

    public lines(key: string): readonly string[] {
        return this.operations.get(key)?.buffer.lines ?? []
    }

    public text(key: string): string {
        return this.operations.get(key)?.buffer.text() ?? ''
    }

    public wasCancelled(key: string): boolean {
        return this.operations.get(key)?.wasCancelled === true
    }

    public async cancel(key: string): Promise<void> {
        await this.operations.get(key)?.cancel()
    }

    public discard(key: string): void {
        this.operations.delete(key)
    }

    protected async run(
        clusterId: string,
        key: string,
        request: THelmStreamRequest,
        sink: IHelmOperationSink,
    ): Promise<void> {
        const session = new HelmOperationSession(key, sink)
        this.operations.set(key, session)

        const stream = this.contexts.stream(clusterId, await this.environmentOf(clusterId))
        session.attach(await stream.run(request, session))
    }

    protected async context(clusterId: string): Promise<HelmEntityContext> {
        return this.contexts.context(clusterId, await this.environmentOf(clusterId))
    }
}

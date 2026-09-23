import { inject, singleton } from 'tsyringe'
import { UpdateInstaller } from '@/application/services/update/constants/UpdateInstaller'
import type { IUpdateProgressSink } from '@/application/services/update/types/IUpdateProgressSink'
import type { TDownloadedUpdate } from '@/application/services/update/types/TDownloadedUpdate'
import type { TUpdateAsset } from '@/application/services/update/types/TUpdateAsset'
import type { TUpdateOffer } from '@/application/services/update/types/TUpdateOffer'
import type { TUpdateSettlement } from '@/application/services/update/types/TUpdateSettlement'
import { AppEnvironment } from '@/config/AppEnvironment'
import { ReleaseAssetSelector } from '@/domain/entities/release'
import type { ReleaseAssetEntity, ReleaseEntity } from '@/domain/entities/release'
import { ApiError } from '@/domain/errors/ApiError'
import { AppVersion } from '@/domain/models/update'
import { DownloadAdapter } from '@/infrastructure/download/DownloadAdapter'
import { DownloadRun } from '@/infrastructure/download/DownloadRun'
import { ReleaseContextProvider } from '@/infrastructure/entityRepo/release/ReleaseContextProvider'
import { ReleaseEntitySetOptions } from '@/infrastructure/entityRepo/release/ReleaseEntitySetOptions'
import { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { PendingUpdateAdapter } from '@/infrastructure/update/PendingUpdateAdapter'
import { AppHostAdapter } from '@/infrastructure/wails/AppHostAdapter'

@singleton()
export class UpdateService {
    private active: DownloadRun | null = null

    private downloading = false

    // A cancel can arrive before the Go side has answered Start with an id to cancel.
    private cancelRequested = false

    constructor(
        @inject(ReleaseContextProvider) private readonly releases: ReleaseContextProvider,
        @inject(DownloadAdapter) private readonly downloads: DownloadAdapter,
        @inject(ProcessAdapter) private readonly processes: ProcessAdapter,
        @inject(AppHostAdapter) private readonly host: AppHostAdapter,
        @inject(HostShellAdapter) private readonly shell: HostShellAdapter,
        @inject(PendingUpdateAdapter) private readonly pending: PendingUpdateAdapter,
    ) {}

    public currentVersion(): string {
        return AppEnvironment.Version
    }

    public async latest(): Promise<TUpdateOffer | null> {
        const release = await this.releases.context.releases.getOne(ReleaseEntitySetOptions.latestKey)
        if (!release || release.draft || release.prerelease) {
            return null
        }

        const version = AppVersion.parse(release.tagName)
        if (!version || !AppVersion.isNewer(release.tagName, this.currentVersion())) {
            return null
        }

        const installer = ReleaseAssetSelector.installerFor(release, await this.host.platform())
        const asset = installer ? UpdateService.assetOf(installer) : null

        return {
            version: version.toString(),
            title: UpdateService.titleOf(release, version.toString()),
            notes: release.body ?? '',
            notesUrl: release.htmlUrl ?? '',
            publishedAt: release.publishedAt ?? '',
            asset,
            installable: !!asset && await this.shell.exists(UpdateInstaller.uninstaller),
        }
    }

    public async download(offer: TUpdateOffer, sink: IUpdateProgressSink): Promise<TDownloadedUpdate | null> {
        const asset = UpdateService.verifiableAsset(offer)
        if (this.downloading) {
            throw new ApiError('An update is already downloading')
        }

        this.downloading = true
        this.cancelRequested = false
        const path = `${PendingUpdateAdapter.Folder}/${asset.name}`

        try {
            const run = await this.downloads.start(
                { url: asset.url, path, headers: { accept: 'application/octet-stream' } },
                sink,
            )
            this.active = run
            if (this.cancelRequested) {
                await run.cancel()
            }

            const outcome = await run.outcome
            if (outcome.cancelled) {
                return null
            }

            if (outcome.sha256 !== asset.sha256) {
                await this.discard(path)
                throw new ApiError(
                    `The downloaded installer of kubiq ${offer.version} is damaged and was deleted`,
                    `SHA-256 ${outcome.sha256}, the release publishes ${asset.sha256}`,
                )
            }

            return { version: offer.version, path, size: outcome.size }
        } catch (err) {
            if (err instanceof ApiError && err.message === DownloadRun.failureMessage) {
                throw new ApiError(`Could not download kubiq ${offer.version}`, err.details)
            }
            throw err
        } finally {
            this.active = null
            this.downloading = false
        }
    }

    public async cancelDownload(): Promise<void> {
        if (!this.downloading) {
            return
        }

        this.cancelRequested = true
        await this.active?.cancel()
    }

    public async install(update: TDownloadedUpdate): Promise<void> {
        await this.pending.write({ version: update.version, installer: update.path })

        try {
            await this.processes.launch({ path: update.path, args: [...UpdateInstaller.args] })
        } catch (err) {
            await this.pending.clear()
            throw new ApiError(
                `Could not start the installer of kubiq ${update.version}`,
                err instanceof ApiError ? err.details : String(err),
            )
        }

        await this.host.quit()
    }

    public async settle(): Promise<TUpdateSettlement | null> {
        const pending = await this.pending.read()
        if (!pending) {
            return null
        }

        await this.pending.clear()
        await this.discard(pending.installer)

        const current = this.currentVersion()

        return { target: pending.version, current, applied: !AppVersion.isNewer(pending.version, current) }
    }

    public openReleasePage(offer: TUpdateOffer): Promise<void> {
        return this.shell.openUri(offer.notesUrl)
    }

    // A leftover installer costs disk space and nothing else, so failing to delete one is not worth a toast.
    private async discard(path: string): Promise<void> {
        try {
            await this.pending.removeFile(path)
        } catch {
            return
        }
    }

    private static verifiableAsset(offer: TUpdateOffer): TUpdateAsset {
        if (!offer.asset) {
            throw new ApiError(`kubiq ${offer.version} has no installer for this system`)
        }
        if (offer.asset.sha256 === '') {
            throw new ApiError(
                `kubiq ${offer.version} publishes no checksum for its installer, so it cannot be verified`,
                offer.asset.name,
            )
        }

        return offer.asset
    }

    private static assetOf(asset: ReleaseAssetEntity): TUpdateAsset {
        return {
            name: asset.name,
            url: asset.browserDownloadUrl,
            size: asset.size ?? 0,
            sha256: ReleaseAssetSelector.sha256Of(asset),
        }
    }

    private static titleOf(release: ReleaseEntity, version: string): string {
        return (release.name ?? '').trim() || `kubiq ${version}`
    }
}

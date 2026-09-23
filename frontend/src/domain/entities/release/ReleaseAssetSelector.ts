import type { ReleaseAssetEntity } from '@/domain/entities/release/ReleaseAssetEntity'
import type { ReleaseEntity } from '@/domain/entities/release/ReleaseEntity'
import type { TReleasePlatform } from '@/domain/entities/release/types/TReleasePlatform'

export class ReleaseAssetSelector {
    private static readonly sha256Prefix = 'sha256:'

    private static readonly sha256Pattern = /^[0-9a-f]{64}$/

    public static installerFor(release: ReleaseEntity, platform: TReleasePlatform): ReleaseAssetEntity | undefined {
        if (platform.os !== 'windows') {
            return undefined
        }

        const suffix = `-windows-${platform.arch}-installer.exe`

        return (release.assets ?? []).find(asset => asset.name.toLowerCase().endsWith(suffix))
    }

    public static sha256Of(asset: ReleaseAssetEntity): string {
        const digest = (asset.digest ?? '').trim().toLowerCase()
        if (!digest.startsWith(ReleaseAssetSelector.sha256Prefix)) {
            return ''
        }

        const value = digest.slice(ReleaseAssetSelector.sha256Prefix.length)

        return ReleaseAssetSelector.sha256Pattern.test(value) ? value : ''
    }
}

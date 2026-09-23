import { describe, expect, it } from 'vitest'
import { NamingStrategies } from '@iappx/entity-repo'
import { ReleaseAssetSelector, ReleaseEntity } from '@/domain/entities/release'

const digest = 'a'.repeat(64)

const release = (): ReleaseEntity => ReleaseEntity.build({
    id: 1,
    tag_name: 'v0.2.0',
    assets: [
        { id: 11, name: 'kubiq-0.2.0-linux-amd64', size: 10, digest: `sha256:${'b'.repeat(64)}` },
        { id: 12, name: 'kubiq-0.2.0-windows-amd64.exe', size: 20, digest: `sha256:${'c'.repeat(64)}` },
        { id: 13, name: 'kubiq-0.2.0-windows-amd64-installer.exe', size: 30, digest: `sha256:${digest}` },
        { id: 14, name: 'kubiq.deb', size: 40 },
    ],
}, { naming: NamingStrategies.snakeCase })

describe('ReleaseAssetSelector', () => {
    it('picks the installer built for the running Windows architecture', () => {
        const asset = ReleaseAssetSelector.installerFor(release(), { os: 'windows', arch: 'amd64' })

        expect(asset?.name).toBe('kubiq-0.2.0-windows-amd64-installer.exe')
    })

    it('finds nothing for an architecture the release was not built for', () => {
        expect(ReleaseAssetSelector.installerFor(release(), { os: 'windows', arch: 'arm64' })).toBeUndefined()
    })

    it('offers no installer outside Windows', () => {
        expect(ReleaseAssetSelector.installerFor(release(), { os: 'linux', arch: 'amd64' })).toBeUndefined()
        expect(ReleaseAssetSelector.installerFor(release(), { os: '', arch: '' })).toBeUndefined()
    })

    it('reads the sha256 GitHub publishes for an asset', () => {
        const asset = ReleaseAssetSelector.installerFor(release(), { os: 'windows', arch: 'amd64' })!

        expect(ReleaseAssetSelector.sha256Of(asset)).toBe(digest)
    })

    it('answers no digest when the asset has none or it is not a sha256', () => {
        const [, , , deb] = release().assets

        expect(ReleaseAssetSelector.sha256Of(deb)).toBe('')

        deb.digest = 'md5:0123'
        expect(ReleaseAssetSelector.sha256Of(deb)).toBe('')

        deb.digest = 'sha256:not-hex'
        expect(ReleaseAssetSelector.sha256Of(deb)).toBe('')
    })
})

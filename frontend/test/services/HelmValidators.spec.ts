import { describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { HelmInstallValidator } from '@/application/validators/HelmInstallValidator'
import { HelmRepositoryValidator } from '@/application/validators/HelmRepositoryValidator'
import { HelmUpgradeValidator } from '@/application/validators/HelmUpgradeValidator'

const installValidator = container.resolve(HelmInstallValidator)
const upgradeValidator = container.resolve(HelmUpgradeValidator)
const repositoryValidator = container.resolve(HelmRepositoryValidator)

const install = (changes: Record<string, unknown> = {}) => ({
    releaseName: 'web',
    namespace: 'dev',
    createNamespace: false,
    chart: 'bitnami/nginx',
    version: '',
    values: 'replicaCount: 2\n',
    ...changes,
} as any)

const upgrade = (changes: Record<string, unknown> = {}) => ({
    releaseName: 'web',
    namespace: 'dev',
    chart: 'bitnami/nginx',
    version: '',
    values: '',
    reuseValues: false,
    ...changes,
} as any)

describe('HelmInstallValidator', () => {
    it('accepts a complete draft', () => {
        expect(installValidator.validate(install()).valid).toBe(true)
    })

    it('collects every problem in one pass', () => {
        const result = installValidator.validate(install({
            releaseName: 'Web Server',
            namespace: 'Dev',
            chart: '',
            values: '- a list\n',
        }))

        expect(result.valid).toBe(false)
        expect(Object.keys(result.errors).sort()).toEqual(['chart', 'namespace', 'releaseName', 'values'])
    })

    it('holds a release name to what helm accepts', () => {
        expect(installValidator.validate(install({ releaseName: '' })).errors.releaseName).toBeTruthy()
        expect(installValidator.validate(install({ releaseName: '-web' })).errors.releaseName).toBeTruthy()
        expect(installValidator.validate(install({ releaseName: 'a'.repeat(54) })).errors.releaseName).toBeTruthy()
        expect(installValidator.validate(install({ releaseName: 'web.api-1' })).valid).toBe(true)
    })
})

describe('HelmUpgradeValidator', () => {
    it('accepts a chart with no version chosen', () => {
        expect(upgradeValidator.validate(upgrade()).valid).toBe(true)
    })

    it('refuses an empty chart and unreadable values', () => {
        const result = upgradeValidator.validate(upgrade({ chart: '', values: 'a: [\n' }))

        expect(result.errors.chart).toBeTruthy()
        expect(result.errors.values).toBeTruthy()
    })
})

describe('HelmRepositoryValidator', () => {
    it('accepts an http, https or oci address', () => {
        expect(repositoryValidator.validate({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' }).valid).toBe(true)
        expect(repositoryValidator.validate({ name: 'local', url: 'http://127.0.0.1:8879' }).valid).toBe(true)
        expect(repositoryValidator.validate({ name: 'registry', url: 'oci://ghcr.io/charts' }).valid).toBe(true)
    })

    it('refuses a name helm would not take and an address that is not one', () => {
        expect(repositoryValidator.validate({ name: 'two words', url: 'https://charts.example.com' }).errors.name).toBeTruthy()
        expect(repositoryValidator.validate({ name: 'bitnami', url: 'charts.example.com' }).errors.url).toBeTruthy()
        expect(repositoryValidator.validate({ name: '', url: '' }).valid).toBe(false)
    })
})

import { describe, expect, it } from 'vitest'
import { KubeCrdReader } from '@/domain/models/kube'
import { KubeDiscoveryFixtures } from '../../support/fixtures/KubeDiscoveryFixtures'

describe('KubeCrdReader', () => {
    it('emits one kind per served version and skips the rest', () => {
        const kinds = KubeCrdReader.read(KubeDiscoveryFixtures.certificateCrd())

        expect(kinds).toHaveLength(1)
        expect(kinds[0].version).toBe('v1')
        expect(kinds[0].key).toBe('cert-manager.io/v1/certificates')
        expect(kinds[0].kind).toBe('Certificate')
        expect(kinds[0].resource).toBe('certificates')
    })

    it('files a custom resource under its own section with a custom marker', () => {
        const kind = KubeCrdReader.read(KubeDiscoveryFixtures.certificateCrd())[0]

        expect(kind.section).toBe('custom')
        expect(kind.isCustom).toBe(true)
        expect(kind.icon).toBe(KubeCrdReader.icon)
    })

    it('reads the scope', () => {
        expect(KubeCrdReader.read(KubeDiscoveryFixtures.certificateCrd())[0].namespaced).toBe(true)
        expect(KubeCrdReader.read(KubeDiscoveryFixtures.plainCrd())[0].namespaced).toBe(false)
    })

    it('turns additionalPrinterColumns into columns that carry their jsonPath', () => {
        const columns = KubeCrdReader.read(KubeDiscoveryFixtures.certificateCrd())[0].columns

        expect(columns.map(p => p.title)).toEqual(['Name', 'Namespace', 'Ready', 'Secret', 'Issuer', 'Age'])
        expect(columns[2]).toEqual({
            key: 'Ready',
            title: 'Ready',
            jsonPath: '.status.conditions[0].status',
            priority: undefined,
        })
        expect(columns[4].priority).toBe(1)
    })

    it('leaves the leading name columns without a jsonPath, since the entity carries them', () => {
        const columns = KubeCrdReader.read(KubeDiscoveryFixtures.certificateCrd())[0].columns

        expect(columns[0]).toEqual({ key: 'name', title: 'Name' })
        expect(columns[1]).toEqual({ key: 'namespace', title: 'Namespace' })
    })

    it('falls back to the base columns when the CRD declares none', () => {
        const columns = KubeCrdReader.read(KubeDiscoveryFixtures.plainCrd())[0].columns

        expect(columns.map(p => p.key)).toEqual(['name', 'createdAt'])
    })

    it('ignores a printer column with no jsonPath', () => {
        const crd = KubeDiscoveryFixtures.plainCrd()
        crd.spec!.versions![0].additionalPrinterColumns = [{ name: 'Broken', type: 'string' }]

        expect(KubeCrdReader.read(crd)[0].columns.map(p => p.key)).toEqual(['name', 'createdAt'])
    })

    it('returns nothing for a document that names no group, plural or kind', () => {
        expect(KubeCrdReader.read({})).toEqual([])
        expect(KubeCrdReader.read({ spec: { group: 'example.test' } })).toEqual([])
    })
})

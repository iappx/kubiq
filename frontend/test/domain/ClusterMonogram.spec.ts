import { describe, expect, it } from 'vitest'
import { ClusterIconColorCatalog } from '@/domain/entities/catalog/ClusterIconColorCatalog'
import { ClusterMonogram } from '@/domain/entities/catalog/ClusterMonogram'

describe('ClusterMonogram', () => {
    describe('initials', () => {
        it('takes the first letter of the first two words', () => {
            expect(ClusterMonogram.initialsOf('prod-eu-west')).toBe('PE')
            expect(ClusterMonogram.initialsOf('staging_cluster')).toBe('SC')
            expect(ClusterMonogram.initialsOf('dev.local')).toBe('DL')
        })

        it('takes the first two letters of a single word', () => {
            expect(ClusterMonogram.initialsOf('minikube')).toBe('MI')
        })

        it('splits a camel-cased name into words', () => {
            expect(ClusterMonogram.initialsOf('dockerDesktop')).toBe('DD')
        })

        it('keeps a digit that stands as a word of its own', () => {
            expect(ClusterMonogram.initialsOf('prod-2')).toBe('P2')
        })

        it('reads the cluster name out of an EKS ARN rather than the ARN prefix', () => {
            expect(ClusterMonogram.initialsOf('arn:aws:eks:eu-west-1:123456789012:cluster/payments')).toBe('PA')
        })

        it('keeps letters outside the Latin alphabet', () => {
            expect(ClusterMonogram.initialsOf('кластер-тест')).toBe('КТ')
        })

        it('answers a placeholder for a name with nothing to take letters from', () => {
            expect(ClusterMonogram.initialsOf('')).toBe(ClusterMonogram.placeholder)
            expect(ClusterMonogram.initialsOf('---')).toBe(ClusterMonogram.placeholder)
        })
    })

    describe('normalizing what the operator typed', () => {
        it('upper-cases and drops whitespace', () => {
            expect(ClusterMonogram.normalize(' p r ')).toBe('PR')
        })

        it('keeps at most four characters', () => {
            expect(ClusterMonogram.normalize('abcdef')).toBe('ABCD')
        })

        it('counts an emoji as one character, not two halves', () => {
            expect(ClusterMonogram.normalize('🚀🚀🚀🚀🚀')).toBe('🚀🚀🚀🚀')
        })
    })

    describe('color', () => {
        it('gives the same name the same color every time', () => {
            expect(ClusterMonogram.colorOf('prod')).toBe(ClusterMonogram.colorOf('prod'))
        })

        it('picks a color from the palette', () => {
            for (const name of ['prod', 'staging', 'lab', 'minikube', 'kind-kind', '']) {
                expect(ClusterIconColorCatalog.has(ClusterMonogram.colorOf(name))).toBe(true)
            }
        })

        it('spreads different names over more than one color', () => {
            const colors = new Set(['prod', 'staging', 'lab', 'dev', 'qa', 'minikube', 'kind', 'docker'].map(ClusterMonogram.colorOf))

            expect(colors.size).toBeGreaterThan(2)
        })
    })

    it('builds an initials icon by default', () => {
        const icon = ClusterMonogram.iconFor('prod-eu')

        expect(icon.kind).toBe('initials')
        expect(icon.initials).toBe('PE')
        expect(icon.color).toBe(ClusterMonogram.colorOf('prod-eu'))
        expect(icon.imageUrl).toBe('')
    })
})

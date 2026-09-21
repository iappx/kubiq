import { describe, expect, it } from 'vitest'
import { HelmValuesDocument } from '@/application/services/helm/models/HelmValuesDocument'

describe('HelmValuesDocument', () => {
    it('accepts a mapping and an empty document', () => {
        expect(HelmValuesDocument.error('replicaCount: 2\n')).toBe('')
        expect(HelmValuesDocument.error('   ')).toBe('')
        expect(HelmValuesDocument.error('{}')).toBe('')
    })

    it('refuses a list and a bare scalar, which no chart can take', () => {
        expect(HelmValuesDocument.error('- one\n- two\n')).not.toBe('')
        expect(HelmValuesDocument.error('42')).not.toBe('')
    })

    it('points at the line of a syntax error without quoting it', () => {
        const message = HelmValuesDocument.error('image:\n  tag: "unterminated\n')

        expect(message).toContain('line')
        expect(message).not.toContain('unterminated')
    })

    it('hands helm an empty mapping rather than an empty file', () => {
        expect(HelmValuesDocument.orEmpty('  ')).toBe(HelmValuesDocument.empty)
        expect(HelmValuesDocument.orEmpty('a: 1')).toBe('a: 1')
    })
})

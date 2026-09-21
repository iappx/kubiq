import { describe, expect, it } from 'vitest'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import { ApiError } from '@/domain/errors/ApiError'

const manifest = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'api', namespace: 'payments', labels: { app: 'api' } },
    spec: { replicas: 3, template: { spec: { containers: [{ name: 'api', image: 'ghcr.io/acme/api:1.4.0' }] } } },
}

describe('YamlDocument', () => {
    it('round-trips a manifest without changing its meaning', () => {
        expect(YamlDocument.parse(YamlDocument.text(manifest))).toEqual(manifest)
    })

    it('keeps the key order the cluster sent', () => {
        const text = YamlDocument.text(manifest)

        expect(text.indexOf('apiVersion')).toBeLessThan(text.indexOf('kind'))
        expect(text.indexOf('kind')).toBeLessThan(text.indexOf('metadata'))
    })

    it('never folds a long value onto a second line', () => {
        const long = { metadata: { annotations: { command: 'a'.repeat(300) } } }

        expect(YamlDocument.text(long)).toContain('a'.repeat(300))
    })

    it('reports a syntax error as a business error rather than throwing the parser one', () => {
        expect(() => YamlDocument.parse('a:\n  - b\n c: d')).toThrow(ApiError)
    })

    it('refuses a document that is not a mapping', () => {
        expect(YamlDocument.tryParse('- one\n- two').error).toBe(YamlDocument.notAMapping)
    })

    it('reports an empty document as not a mapping rather than as an object', () => {
        expect(YamlDocument.tryParse('').error).toBe(YamlDocument.notAMapping)
    })

    it('carries the parser message as the technical detail', () => {
        expect(YamlDocument.tryParse('a:\n  - b\n c: d').detail).not.toBe('')
    })

    it('splits lines the same way whatever the line endings were', () => {
        expect(YamlDocument.lines('a\r\nb\r\nc')).toEqual(['a', 'b', 'c'])
    })
})

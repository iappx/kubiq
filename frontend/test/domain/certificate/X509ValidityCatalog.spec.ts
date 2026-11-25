import { describe, expect, it } from 'vitest'
import { X509ValidityCatalog } from '@/domain/models/certificate'

describe('X509ValidityCatalog', () => {
    it('maps validity values to labels and health states', () => {
        expect(X509ValidityCatalog.label('valid')).toBe('Valid')
        expect(X509ValidityCatalog.label('expiring')).toBe('Expiring soon')
        expect(X509ValidityCatalog.label('expired')).toBe('Expired')
        expect(X509ValidityCatalog.label('not-yet-valid')).toBe('Not yet valid')

        expect(X509ValidityCatalog.state('valid')).toBe('ok')
        expect(X509ValidityCatalog.state('expiring')).toBe('warning')
        expect(X509ValidityCatalog.state('expired')).toBe('error')
        expect(X509ValidityCatalog.state('not-yet-valid')).toBe('error')
    })

    it('picks the worst validity in severity order', () => {
        expect(X509ValidityCatalog.worst(['valid', 'valid'])).toBe('valid')
        expect(X509ValidityCatalog.worst(['valid', 'expiring'])).toBe('expiring')
        expect(X509ValidityCatalog.worst(['expiring', 'not-yet-valid'])).toBe('not-yet-valid')
        expect(X509ValidityCatalog.worst(['not-yet-valid', 'expired', 'valid'])).toBe('expired')
    })
})

import { describe, expect, it } from 'vitest'
import { PrometheusSourceCatalog } from '@/domain/entities/settings'

describe('PrometheusSourceCatalog', () => {
    it('names every source it knows', () => {
        expect(Object.keys(PrometheusSourceCatalog.values).sort()).toEqual(['none', 'service', 'url'])
        expect(PrometheusSourceCatalog.title('url')).toBe('Prometheus address')
    })

    it('recognises only its own values', () => {
        expect(PrometheusSourceCatalog.has('service')).toBe(true)
        expect(PrometheusSourceCatalog.has('thanos')).toBe(false)
    })

    it('parses an unknown value back to the default', () => {
        expect(PrometheusSourceCatalog.parse('service')).toBe('service')
        expect(PrometheusSourceCatalog.parse('thanos')).toBe('none')
        expect(PrometheusSourceCatalog.parse(undefined)).toBe('none')
    })

    it('says which sources count as configured', () => {
        expect(PrometheusSourceCatalog.isConfigured('none')).toBe(false)
        expect(PrometheusSourceCatalog.isConfigured('url')).toBe(true)
        expect(PrometheusSourceCatalog.isConfigured('service')).toBe(true)
    })
})

import { describe, expect, it } from 'vitest'
import { ClusterSettingsValidator } from '@/application/validators/ClusterSettingsValidator'
import type { TClusterSettingsDraft } from '@/domain/entities/settings'

const validator = new ClusterSettingsValidator()

const draft = (overrides: Partial<TClusterSettingsDraft> = {}): TClusterSettingsDraft => ({
    clusterId: 'prod',
    prometheusSource: 'none',
    prometheusUrl: '',
    prometheusService: '',
    ...overrides,
})

describe('ClusterSettingsValidator', () => {
    it('accepts a cluster whose metrics are deliberately off', () => {
        expect(validator.validate(draft())).toEqual({ valid: true, errors: {} })
    })

    it('needs a cluster to attach the settings to', () => {
        const result = validator.validate(draft({ clusterId: '   ' }))

        expect(result.valid).toBe(false)
        expect(result.errors.clusterId).toBeTruthy()
    })

    it('refuses a source it does not know', () => {
        const result = validator.validate(draft({ prometheusSource: 'thanos' as never }))

        expect(result.valid).toBe(false)
        expect(result.errors.prometheusSource).toBeTruthy()
    })

    it('accepts an http and an https address', () => {
        expect(validator.validate(draft({ prometheusSource: 'url', prometheusUrl: 'http://prometheus:9090' })).valid).toBe(true)
        expect(validator.validate(draft({ prometheusSource: 'url', prometheusUrl: 'https://metrics.internal/api' })).valid).toBe(true)
    })

    it('needs an address once the source is one', () => {
        const result = validator.validate(draft({ prometheusSource: 'url' }))

        expect(result.errors.prometheusUrl).toBe('Enter the address of the Prometheus HTTP API')
    })

    it('refuses an address that is not one', () => {
        const result = validator.validate(draft({ prometheusSource: 'url', prometheusUrl: 'prometheus:9090' }))

        expect(result.valid).toBe(false)
        expect(result.errors.prometheusUrl).toBeTruthy()
    })

    it('refuses a scheme Prometheus is not reached over', () => {
        const result = validator.validate(draft({ prometheusSource: 'url', prometheusUrl: 'ftp://prometheus:9090' }))

        expect(result.errors.prometheusUrl).toBe('Prometheus is reached over http or https')
    })

    it('accepts a service spelled namespace/name:port', () => {
        expect(validator.validate(draft({
            prometheusSource: 'service',
            prometheusService: 'monitoring/prometheus:9090',
        })).valid).toBe(true)
    })

    it('accepts a named service port', () => {
        expect(validator.validate(draft({
            prometheusSource: 'service',
            prometheusService: 'monitoring/prometheus-operated:web',
        })).valid).toBe(true)
    })

    it.each([
        ['no namespace', 'prometheus:9090'],
        ['no port', 'monitoring/prometheus'],
        ['nothing at all', ''],
        ['upper case, which Kubernetes names never are', 'Monitoring/Prometheus:9090'],
    ])('refuses a service with %s', (_name, value) => {
        const result = validator.validate(draft({ prometheusSource: 'service', prometheusService: value }))

        expect(result.valid).toBe(false)
        expect(result.errors.prometheusService).toBeTruthy()
    })

    it('reports every problem in one pass', () => {
        const result = validator.validate(draft({ clusterId: '', prometheusSource: 'url', prometheusUrl: '' }))

        expect(Object.keys(result.errors).sort()).toEqual(['clusterId', 'prometheusUrl'])
    })

    it('says nothing about the field the chosen source does not use', () => {
        const result = validator.validate(draft({
            prometheusSource: 'url',
            prometheusUrl: 'http://prometheus:9090',
            prometheusService: 'nonsense',
        }))

        expect(result.valid).toBe(true)
    })
})

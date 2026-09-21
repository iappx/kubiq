import { describe, expect, it } from 'vitest'
import { HelmChartRef } from '@/domain/models/helm/HelmChartRef'

describe('HelmChartRef', () => {
    it('splits a reference into its repository and its chart', () => {
        expect(HelmChartRef.repositoryOf('bitnami/nginx')).toBe('bitnami')
        expect(HelmChartRef.chartOf('bitnami/nginx')).toBe('nginx')
    })

    it('treats a bare name as a chart with no repository', () => {
        expect(HelmChartRef.repositoryOf('nginx')).toBe('')
        expect(HelmChartRef.chartOf('nginx')).toBe('nginx')
    })

    it('splits the chart helm reports into a name and a version', () => {
        expect(HelmChartRef.splitChart('nginx-15.1.0')).toEqual({ name: 'nginx', version: '15.1.0' })
        expect(HelmChartRef.splitChart('cert-manager-v1.14.2')).toEqual({ name: 'cert-manager', version: 'v1.14.2' })
        expect(HelmChartRef.splitChart('nginx-15.1.0-beta.1')).toEqual({ name: 'nginx', version: '15.1.0-beta.1' })
    })

    it('leaves a chart with no version recognisable', () => {
        expect(HelmChartRef.splitChart('nginx')).toEqual({ name: 'nginx', version: '' })
    })

    it('builds the keyword helm search repo expects', () => {
        expect(HelmChartRef.keyword('nginx', 'bitnami')).toBe('bitnami/nginx')
        expect(HelmChartRef.keyword('nginx', '')).toBe('nginx')
        expect(HelmChartRef.keyword('', 'bitnami')).toBe('bitnami/')
        expect(HelmChartRef.keyword('', '')).toBe('')
    })
})

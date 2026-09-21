import { describe, expect, it } from 'vitest'
import { HelmOutput } from '@/domain/models/helm/HelmOutput'

describe('HelmOutput', () => {
    it('turns a helm list answer into release records', () => {
        const records = HelmOutput.releases([
            {
                name: 'web',
                namespace: 'dev',
                revision: '3',
                updated: '2026-05-01T10:11:12.123456+02:00',
                status: 'deployed',
                chart: 'nginx-15.1.0',
                app_version: '1.25.3',
            },
        ])

        expect(records).toEqual([{
            id: 'dev/web',
            name: 'web',
            namespace: 'dev',
            revision: 3,
            updated: '2026-05-01T10:11:12.123456+02:00',
            status: 'deployed',
            chart: 'nginx-15.1.0',
            chartName: 'nginx',
            chartVersion: '15.1.0',
            appVersion: '1.25.3',
        }])
    })

    it('reads a status helm does not document as unknown instead of failing', () => {
        const [record] = HelmOutput.releases([{ name: 'web', namespace: 'dev', status: 'something-else' }])

        expect(record.status).toBe('unknown')
    })

    it('answers an empty collection for anything that is not a list', () => {
        expect(HelmOutput.releases(null)).toEqual([])
        expect(HelmOutput.releases({})).toEqual([])
        expect(HelmOutput.repositories('')).toEqual([])
        expect(HelmOutput.charts(undefined)).toEqual([])
    })

    it('drops a row with no name, because it cannot be addressed', () => {
        expect(HelmOutput.releases([{ namespace: 'dev' }])).toEqual([])
        expect(HelmOutput.repositories([{ url: 'https://charts.example.com' }])).toEqual([])
    })

    it('keys a revision by its release and number', () => {
        const records = HelmOutput.revisions(
            [{ revision: 2, status: 'superseded', chart: 'nginx-15.0.0', description: 'Upgrade complete' }],
            { name: 'web', namespace: 'dev' },
        )

        expect(records[0]).toMatchObject({
            id: 'dev/web@2',
            releaseName: 'web',
            namespace: 'dev',
            revision: 2,
            status: 'superseded',
            description: 'Upgrade complete',
        })
    })

    it('splits a searched chart into its repository and its chart name', () => {
        const [record] = HelmOutput.charts([
            { name: 'bitnami/nginx', version: '15.1.0', app_version: '1.25.3', description: 'A web server' },
        ])

        expect(record).toEqual({
            id: 'bitnami/nginx@15.1.0',
            ref: 'bitnami/nginx',
            repoName: 'bitnami',
            chartName: 'nginx',
            version: '15.1.0',
            appVersion: '1.25.3',
            description: 'A web server',
        })
    })
})

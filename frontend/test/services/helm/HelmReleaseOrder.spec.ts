import { describe, expect, it } from 'vitest'
import { HelmReleaseOrder } from '@/application/services/helm/models/HelmReleaseOrder'
import { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'

const release = (name: string, namespace: string, updated: string) => HelmReleaseEntity.build({
    id: `${namespace}/${name}`,
    name,
    namespace,
    revision: 1,
    updated,
    status: 'deployed',
    chart: 'nginx-15.1.0',
    chartName: 'nginx',
    chartVersion: '15.1.0',
    appVersion: '1.25.3',
})

const names = (releases: readonly HelmReleaseEntity[]) => releases.map(entity => entity.id)

describe('HelmReleaseOrder', () => {
    it('puts the most recently updated release first across namespaces', () => {
        const merged = HelmReleaseOrder.merge([
            [release('web', 'dev', '2026-05-01 10:00:00.123456789 +0000 UTC')],
            [release('api', 'prod', '2026-05-03 09:00:00.000000001 +0000 UTC')],
            [release('cache', 'infra', '2026-05-02 23:59:59.999999999 +0000 UTC')],
        ], 10)

        expect(names(merged)).toEqual(['prod/api', 'infra/cache', 'dev/web'])
    })

    it('reads the zone helm printed instead of assuming UTC', () => {
        const merged = HelmReleaseOrder.merge([
            [release('early', 'dev', '2026-05-01 12:00:00 +0300 MSK')],
            [release('late', 'dev', '2026-05-01 10:00:00 -0700 MST')],
        ], 10)

        expect(names(merged)).toEqual(['dev/late', 'dev/early'])
    })

    it('reads a plain ISO timestamp as well', () => {
        const merged = HelmReleaseOrder.merge([
            [release('old', 'dev', '2026-05-01T10:00:00Z')],
            [release('new', 'dev', '2026-05-04T10:00:00Z')],
        ], 10)

        expect(names(merged)).toEqual(['dev/new', 'dev/old'])
    })

    it('does not depend on how the scope was split when two releases share a moment', () => {
        const moment = '2026-05-01 10:00:00 +0000 UTC'
        const left = HelmReleaseOrder.merge([[release('a', 'dev', moment)], [release('b', 'prod', moment)]], 10)
        const right = HelmReleaseOrder.merge([[release('b', 'prod', moment)], [release('a', 'dev', moment)]], 10)

        expect(names(left)).toEqual(names(right))
    })

    it('sinks a release helm dated with something unreadable instead of dropping it', () => {
        const merged = HelmReleaseOrder.merge([
            [release('broken', 'dev', 'whenever')],
            [release('web', 'dev', '2026-05-01 10:00:00 +0000 UTC')],
        ], 10)

        expect(names(merged)).toEqual(['dev/web', 'dev/broken'])
    })

    it('caps the merged list at the same limit a single query would have used', () => {
        const batch = (namespace: string) => Array.from({ length: 4 }, (unused, index) => release(
            `app-${index}`,
            namespace,
            `2026-05-0${index + 1} 10:00:00 +0000 UTC`,
        ))

        expect(HelmReleaseOrder.merge([batch('dev'), batch('prod')], 5)).toHaveLength(5)
    })
})

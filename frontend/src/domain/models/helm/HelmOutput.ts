import { HelmReleaseStatusCatalog } from '@/domain/entities/helm/HelmReleaseStatusCatalog'
import type { THelmReleaseRef } from '@/domain/entities/helm/types/THelmReleaseRef'
import { HelmChartRef } from '@/domain/models/helm/HelmChartRef'
import { HelmReleaseKey } from '@/domain/models/helm/HelmReleaseKey'

export class HelmOutput {
    public static releases(raw: unknown): Record<string, unknown>[] {
        return HelmOutput.records(raw)
            .map(record => HelmOutput.release(record))
            .filter(release => release.name !== '')
    }

    public static revisions(raw: unknown, ref: THelmReleaseRef): Record<string, unknown>[] {
        return HelmOutput.records(raw)
            .map(record => HelmOutput.revision(record, ref))
            .filter(revision => revision.revision !== 0)
    }

    public static repositories(raw: unknown): Record<string, unknown>[] {
        return HelmOutput.records(raw)
            .map(record => ({
                name: HelmOutput.text(record.name),
                url: HelmOutput.text(record.url),
            }))
            .filter(repository => repository.name !== '')
    }

    public static charts(raw: unknown): Record<string, unknown>[] {
        return HelmOutput.records(raw)
            .map(record => HelmOutput.chart(record))
            .filter(chart => chart.ref !== '')
    }

    public static records(raw: unknown): Record<string, unknown>[] {
        return Array.isArray(raw)
            ? raw.filter(item => !!item && typeof item === 'object') as Record<string, unknown>[]
            : []
    }

    public static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }

    public static count(value: unknown): number {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value
        }

        const parsed = Number.parseInt(HelmOutput.text(value), 10)

        return Number.isFinite(parsed) ? parsed : 0
    }

    private static release(record: Record<string, unknown>): Record<string, unknown> {
        const name = HelmOutput.text(record.name)
        const namespace = HelmOutput.text(record.namespace)
        const chart = HelmOutput.text(record.chart)
        const parts = HelmChartRef.splitChart(chart)

        return {
            id: HelmReleaseKey.of(namespace, name),
            name,
            namespace,
            revision: HelmOutput.count(record.revision),
            updated: HelmOutput.text(record.updated),
            status: HelmReleaseStatusCatalog.parse(record.status),
            chart,
            chartName: parts.name,
            chartVersion: parts.version,
            appVersion: HelmOutput.text(record.app_version),
        }
    }

    private static revision(record: Record<string, unknown>, ref: THelmReleaseRef): Record<string, unknown> {
        const revision = HelmOutput.count(record.revision)

        return {
            id: HelmReleaseKey.forRevision(ref.namespace, ref.name, revision),
            releaseName: ref.name,
            namespace: ref.namespace,
            revision,
            updated: HelmOutput.text(record.updated),
            status: HelmReleaseStatusCatalog.parse(record.status),
            chart: HelmOutput.text(record.chart),
            appVersion: HelmOutput.text(record.app_version),
            description: HelmOutput.text(record.description),
        }
    }

    private static chart(record: Record<string, unknown>): Record<string, unknown> {
        const ref = HelmOutput.text(record.name)
        const version = HelmOutput.text(record.version)

        return {
            id: HelmChartRef.idOf(ref, version),
            ref,
            repoName: HelmChartRef.repositoryOf(ref),
            chartName: HelmChartRef.chartOf(ref),
            version,
            appVersion: HelmOutput.text(record.app_version),
            description: HelmOutput.text(record.description),
        }
    }
}

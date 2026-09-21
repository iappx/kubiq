import { HelmReleaseStatusCatalog } from '@/domain/entities/helm/HelmReleaseStatusCatalog'
import type { HelmReleaseEntity } from '@/domain/entities/helm/HelmReleaseEntity'
import type { THelmReleaseRow } from '@/components/helm/types/THelmReleaseRow'

export class HelmReleaseRowBuilder {
    public static build(releases: readonly HelmReleaseEntity[]): THelmReleaseRow[] {
        return releases.map(release => HelmReleaseRowBuilder.row(release))
    }

    public static row(release: HelmReleaseEntity): THelmReleaseRow {
        return {
            id: release.id,
            name: release.name,
            namespace: release.namespace,
            status: release.status,
            statusText: HelmReleaseStatusCatalog.title(release.status),
            chart: release.chartName,
            chartVersion: release.chartVersion,
            appVersion: release.appVersion,
            revision: release.revision,
            updated: release.updated,
        }
    }
}

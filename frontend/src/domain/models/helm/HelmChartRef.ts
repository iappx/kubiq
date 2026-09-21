import type { THelmChartName } from '@/domain/models/helm/types/THelmChartName'

export class HelmChartRef {
    public static repositoryOf(ref: string): string {
        const separator = ref.indexOf('/')

        return separator === -1 ? '' : ref.slice(0, separator)
    }

    public static chartOf(ref: string): string {
        const separator = ref.indexOf('/')

        return separator === -1 ? ref : ref.slice(separator + 1)
    }

    public static idOf(ref: string, version: string): string {
        return version === '' ? ref : `${ref}@${version}`
    }

    public static keyword(chartName: string, repoName: string): string {
        if (chartName === '' && repoName === '') {
            return ''
        }

        return repoName === '' ? chartName : `${repoName}/${chartName}`
    }

    // helm reports a chart as "<name>-<version>" and a chart name may itself carry
    // dashes and digits, so the split anchors on the last dash starting a version.
    public static splitChart(chart: string): THelmChartName {
        const match = /^(.*)-(v?\d[^-]*(?:-[^-]*)*)$/.exec(chart)

        return match ? { name: match[1], version: match[2] } : { name: chart, version: '' }
    }
}

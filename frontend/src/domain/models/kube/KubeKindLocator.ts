import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'
import type { TKubeGvr } from '@/domain/models/kube/types/TKubeGvr'

export class KubeKindLocator {
    public static parseApiVersion(apiVersion: string): TKubeGvr {
        const separator = apiVersion.indexOf('/')

        return separator === -1
            ? { group: '', version: apiVersion, resource: '' }
            : { group: apiVersion.slice(0, separator), version: apiVersion.slice(separator + 1), resource: '' }
    }

    // The version is preferred but not required: a manifest written against apps/v1beta1 still names a kind apps/v1 serves.
    public static find(
        kinds: readonly KubeResourceKind[],
        apiVersion: string,
        kind: string,
    ): KubeResourceKind | undefined {
        const gvr = KubeKindLocator.parseApiVersion(apiVersion)
        const inGroup = kinds.filter(served => served.group === gvr.group && served.kind === kind)

        return inGroup.find(served => served.version === gvr.version) ?? inGroup[0]
    }

    public static describe(apiVersion: string, kind: string): string {
        return apiVersion === '' ? kind : `${apiVersion} ${kind}`
    }
}

import { KubeManifest } from '@/domain/models/kube/KubeManifest'
import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'

export class KubePodRelations {
    public static claimNames(pod: Record<string, unknown>): string[] {
        const spec = pod.spec
        const volumes = KubeManifest.isObject(spec) ? spec.volumes : undefined
        if (!Array.isArray(volumes)) {
            return []
        }

        const names = volumes
            .map(volume => KubePodRelations.claimNameOf(volume))
            .filter(name => name !== '')

        return [...new Set(names)]
    }

    public static labelsOf(object: Record<string, unknown>): TKubeLabels {
        const labels = KubeManifest.metadataOf(object).labels

        return KubeManifest.isObject(labels) ? labels as TKubeLabels : {}
    }

    // An empty selector matches nothing here, unlike in Kubernetes: a Service without one is fed by hand-written Endpoints.
    public static matchesSelector(labels: TKubeLabels, selector: TKubeLabels | undefined): boolean {
        const keys = Object.keys(selector ?? {})
        if (keys.length === 0) {
            return false
        }

        return keys.every(key => labels[key] === (selector ?? {})[key])
    }

    private static claimNameOf(volume: unknown): string {
        if (!KubeManifest.isObject(volume)) {
            return ''
        }

        const claim = volume.persistentVolumeClaim
        const name = KubeManifest.isObject(claim) ? claim.claimName : undefined

        return typeof name === 'string' ? name : ''
    }
}

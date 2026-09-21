import type { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class KubeAccessHint {
    public static of(verb: string, kind: KubeResourceKind | null, namespace: string = ''): string {
        if (!kind) {
            return ''
        }

        const scoped = kind.namespaced && namespace !== ''

        return scoped
            ? `A Role granting "${verb}" on "${kind.slug}" in namespace "${namespace}" would allow this.`
            : `A ClusterRole granting "${verb}" on "${kind.slug}" would allow this.`
    }

    public static forResource(verb: string, resource: string, namespace: string = ''): string {
        return namespace === ''
            ? `A ClusterRole granting "${verb}" on "${resource}" would allow this.`
            : `A Role granting "${verb}" on "${resource}" in namespace "${namespace}" would allow this.`
    }
}

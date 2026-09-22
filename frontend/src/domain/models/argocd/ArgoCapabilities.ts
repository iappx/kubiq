import { ArgoResourceKinds } from '@/domain/models/argocd/ArgoResourceKinds'
import type { TArgoCapabilities } from '@/domain/models/argocd/types/TArgoCapabilities'
import type { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'

export class ArgoCapabilities {
    public static of(kinds: readonly KubeResourceKind[]): TArgoCapabilities {
        return {
            applications: ArgoCapabilities.find(kinds, ArgoResourceKinds.applicationsResource),
            appProjects: ArgoCapabilities.find(kinds, ArgoResourceKinds.appProjectsResource),
            applicationSets: ArgoCapabilities.find(kinds, ArgoResourceKinds.applicationSetsResource),
        }
    }

    public static isInstalled(capabilities: TArgoCapabilities): boolean {
        return capabilities.applications !== undefined
    }

    public static canSync(capabilities: TArgoCapabilities): boolean {
        return capabilities.applications?.canPatch === true
    }

    public static canDelete(capabilities: TArgoCapabilities): boolean {
        return capabilities.applications?.canDelete === true
    }

    private static find(kinds: readonly KubeResourceKind[], resource: string): KubeResourceKind | undefined {
        return kinds.find(kind => kind.group === ArgoResourceKinds.group
            && kind.resource === resource
            && kind.canList)
    }
}

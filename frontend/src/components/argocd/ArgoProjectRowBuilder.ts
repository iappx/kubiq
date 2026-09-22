import type { TArgoProjectRow } from '@/components/argocd/types/TArgoProjectRow'
import type { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'
import type { ArgoAppProjectEntity } from '@/domain/entities/argocd/ArgoAppProjectEntity'
import { KubeObjectKey } from '@/domain/entities/kube'

export class ArgoProjectRowBuilder {
    public static build(
        projects: readonly ArgoAppProjectEntity[],
        applications: readonly ArgoApplicationEntity[],
    ): TArgoProjectRow[] {
        return projects.map(project => ArgoProjectRowBuilder.row(project, applications))
    }

    public static row(
        project: ArgoAppProjectEntity,
        applications: readonly ArgoApplicationEntity[],
    ): TArgoProjectRow {
        return {
            key: KubeObjectKey.of(project),
            name: project.name,
            namespace: project.namespace,
            description: project.description,
            sourceRepos: project.sourceReposText,
            destinations: project.destinationsText,
            applicationCount: ArgoProjectRowBuilder.countFor(project.name, applications),
            createdAt: project.createdAt,
        }
    }

    private static countFor(name: string, applications: readonly ArgoApplicationEntity[]): number {
        return applications.reduce((count, application) => count + (application.project === name ? 1 : 0), 0)
    }
}

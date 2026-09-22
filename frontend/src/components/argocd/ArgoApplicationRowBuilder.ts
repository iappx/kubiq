import type { TArgoApplicationRow } from '@/components/argocd/types/TArgoApplicationRow'
import type { ArgoApplicationEntity } from '@/domain/entities/argocd/ArgoApplicationEntity'
import { ArgoHealthStatusCatalog } from '@/domain/entities/argocd/ArgoHealthStatusCatalog'
import { ArgoSyncStatusCatalog } from '@/domain/entities/argocd/ArgoSyncStatusCatalog'
import { KubeObjectKey } from '@/domain/entities/kube'

export class ArgoApplicationRowBuilder {
    public static build(applications: readonly ArgoApplicationEntity[]): TArgoApplicationRow[] {
        return applications.map(application => ArgoApplicationRowBuilder.row(application))
    }

    public static row(application: ArgoApplicationEntity): TArgoApplicationRow {
        return {
            key: KubeObjectKey.of(application),
            name: application.name,
            namespace: application.namespace,
            project: application.project,
            destination: application.destinationCluster,
            destinationNamespace: application.destinationNamespace,
            repoUrl: application.repoUrl,
            sourceText: application.sourceText,
            targetRevision: application.targetRevision,
            syncStatus: application.syncStatus,
            syncText: ArgoSyncStatusCatalog.title(application.syncStatus),
            healthStatus: application.healthStatus,
            healthText: ArgoHealthStatusCatalog.title(application.healthStatus),
            syncPolicyText: application.syncPolicyText,
            operationPhase: application.operationPhase,
            isOperationRunning: application.isOperationRunning,
            resourceCount: application.resources.length,
            createdAt: application.createdAt,
        }
    }
}

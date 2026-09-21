import type { THelmManifestResource } from '@/application/services/helm/types/THelmManifestResource'
import type { HelmRevisionEntity } from '@/domain/entities/helm/HelmRevisionEntity'

export type THelmReleaseDetail = {
    namespace: string
    name: string
    values: string
    computedValues: string
    manifest: string
    notes: string
    resources: THelmManifestResource[]
    revisions: HelmRevisionEntity[]
}

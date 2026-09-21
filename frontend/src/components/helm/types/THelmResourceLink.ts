import type { THelmManifestResource } from '@/application/services/helm/types/THelmManifestResource'

export type THelmResourceLink = {
    key: string
    resource: THelmManifestResource
    title: string
    path: string
}

import type { TKubeAnnotations } from '@/domain/entities/kube/types/TKubeAnnotations'
import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'

export type TKubeJobTemplate = {
    metadata?: {
        labels?: TKubeLabels
        annotations?: TKubeAnnotations
    }
    spec?: Record<string, unknown>
}

import type { TMetadataReferenceTarget } from '@/domain/models/metadata/types/TMetadataReferenceTarget'

export type TMetadataStructuredField = {
    label: string
    value: string
    mono?: boolean
    tone?: 'ok' | 'warning' | 'error' | 'info' | 'unknown'
    reference?: TMetadataReferenceTarget
    url?: string
}

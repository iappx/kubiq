import type { TMetadataEntry } from '@/domain/models/metadata/types/TMetadataEntry'

export type TMetadataGroup = {
    id: string
    title: string
    entries: TMetadataEntry[]
    isNoisy: boolean
}

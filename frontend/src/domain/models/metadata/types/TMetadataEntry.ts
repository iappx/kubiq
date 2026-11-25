import type { TMetadataBase64Hint } from '@/domain/models/metadata/types/TMetadataBase64Hint'
import type { TMetadataKeyParts } from '@/domain/models/metadata/types/TMetadataKeyParts'
import type { TMetadataParsedValue } from '@/domain/models/metadata/types/TMetadataParsedValue'

export type TMetadataEntry = {
    key: string
    rawValue: string
    keyParts: TMetadataKeyParts
    parsed: TMetadataParsedValue
    collapsedByDefault: boolean
    description: string
    base64Hint: TMetadataBase64Hint | null
}

import type { TUpdateAsset } from '@/application/services/update/types/TUpdateAsset'

export type TUpdateOffer = {
    version: string
    title: string
    notes: string
    notesUrl: string
    publishedAt: string
    asset: TUpdateAsset | null
    installable: boolean
}

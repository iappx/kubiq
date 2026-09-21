import type { TPodLogStyle } from '@/components/logs/types/TPodLogStyle'

export type TPodLogCell = {
    text: string
    match: boolean
    stamp: boolean
    style: TPodLogStyle
}

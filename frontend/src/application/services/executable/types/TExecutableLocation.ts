import type { TExecutableSource } from '@/application/services/executable/types/TExecutableSource'

export type TExecutableLocation = {
    name: string
    path: string
    source: TExecutableSource
}

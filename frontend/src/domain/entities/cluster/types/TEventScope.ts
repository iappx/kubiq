import type { TEventType } from '@/domain/entities/cluster/types/TEventType'

export type TEventScope = {
    type: TEventType | ''
    objectKind: string
    objectName: string
}

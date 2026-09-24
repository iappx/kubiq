import type { TConfigObjectKind } from '@/domain/entities/config/types/TConfigObjectKind'

export type TConfigReferenceTarget = {
    objectKind: TConfigObjectKind
    name: string
}

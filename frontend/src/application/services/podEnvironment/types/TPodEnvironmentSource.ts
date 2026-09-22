import type { TPodEnvironmentSourceState } from '@/application/services/podEnvironment/types/TPodEnvironmentSourceState'
import type { TKubeDataMap } from '@/domain/entities/config'

export type TPodEnvironmentSource = {
    state: TPodEnvironmentSourceState
    data: TKubeDataMap
    encoded: boolean
}

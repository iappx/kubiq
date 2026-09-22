import type { TPodEnvironmentEntryState } from '@/application/services/podEnvironment/types/TPodEnvironmentEntryState'

export type TPodEnvironmentEntry = {
    id: string
    variable: string
    value: string
    provenance: string
    masked: boolean
    state: TPodEnvironmentEntryState
}

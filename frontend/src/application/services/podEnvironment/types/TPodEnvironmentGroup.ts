import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'

export type TPodEnvironmentGroup = {
    container: string
    isInit: boolean
    entries: TPodEnvironmentEntry[]
}

import type { TPodEnvironmentImport } from '@/domain/entities/workloads/types/TPodEnvironmentImport'
import type { TPodEnvironmentVariable } from '@/domain/entities/workloads/types/TPodEnvironmentVariable'

export type TPodContainerEnvironment = {
    container: string
    isInit: boolean
    imports: TPodEnvironmentImport[]
    variables: TPodEnvironmentVariable[]
}

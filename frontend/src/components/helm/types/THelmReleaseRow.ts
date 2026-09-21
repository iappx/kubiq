import type { THelmReleaseStatus } from '@/domain/entities/helm/types/THelmReleaseStatus'

export type THelmReleaseRow = {
    id: string
    name: string
    namespace: string
    status: THelmReleaseStatus
    statusText: string
    chart: string
    chartVersion: string
    appVersion: string
    revision: number
    updated: string
}

import type { TNodeIssue } from '@/application/services/clusterOverview/types/TNodeIssue'

export type TNodeHealth = {
    total: number
    ready: number
    issues: TNodeIssue[]
    error: string
}

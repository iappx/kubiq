import type { TArgoHealthStatus } from '@/domain/entities/argocd/types/TArgoHealthStatus'
import type { TArgoOperationPhase } from '@/domain/entities/argocd/types/TArgoOperationPhase'
import type { TArgoSyncStatus } from '@/domain/entities/argocd/types/TArgoSyncStatus'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

export class ArgoToneMap {
    private static readonly sync: Record<TArgoSyncStatus, TUiTone> = {
        Synced: 'ok',
        OutOfSync: 'warning',
        Unknown: 'unknown',
    }

    private static readonly health: Record<TArgoHealthStatus, TUiTone> = {
        Healthy: 'ok',
        Progressing: 'pending',
        Degraded: 'error',
        Suspended: 'pending',
        Missing: 'error',
        Unknown: 'unknown',
    }

    private static readonly phases: Record<TArgoOperationPhase, TUiTone> = {
        Running: 'pending',
        Terminating: 'pending',
        Failed: 'error',
        Error: 'error',
        Succeeded: 'ok',
    }

    public static ofSync(status: TArgoSyncStatus): TUiTone {
        return ArgoToneMap.sync[status] ?? 'unknown'
    }

    public static ofHealth(status: TArgoHealthStatus): TUiTone {
        return ArgoToneMap.health[status] ?? 'unknown'
    }

    public static ofPhase(phase: TArgoOperationPhase | undefined): TUiTone {
        return phase === undefined ? 'unknown' : ArgoToneMap.phases[phase] ?? 'unknown'
    }
}

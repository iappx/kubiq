import type { THelmReleaseStatus } from '@/domain/entities/helm/types/THelmReleaseStatus'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { THelmOperationState } from '@/store/modules/helm/types/THelmOperationState'

export class HelmToneMap {
    private static readonly releases: Record<THelmReleaseStatus, TUiTone> = {
        'unknown': 'unknown',
        'deployed': 'ok',
        'uninstalled': 'unknown',
        'superseded': 'unknown',
        'failed': 'error',
        'uninstalling': 'pending',
        'pending-install': 'pending',
        'pending-upgrade': 'pending',
        'pending-rollback': 'pending',
    }

    private static readonly operations: Record<THelmOperationState, TUiTone> = {
        running: 'pending',
        succeeded: 'ok',
        failed: 'error',
        cancelled: 'warning',
    }

    public static ofRelease(status: THelmReleaseStatus): TUiTone {
        return HelmToneMap.releases[status] ?? 'unknown'
    }

    public static ofOperation(state: THelmOperationState): TUiTone {
        return HelmToneMap.operations[state] ?? 'unknown'
    }
}

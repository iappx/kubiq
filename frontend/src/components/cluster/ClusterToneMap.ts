import type { TClusterStatus } from '@/domain/entities/catalog/types/TClusterStatus'
import type { TUiTone } from '@/components/common/status/types/TUiTone'

export class ClusterToneMap {
    private static readonly tones: Record<TClusterStatus, TUiTone> = {
        connected: 'ok',
        connecting: 'pending',
        available: 'unknown',
        unreachable: 'error',
        unsupported: 'warning',
        expired: 'error',
    }

    public static of(status: TClusterStatus): TUiTone {
        return ClusterToneMap.tones[status] ?? 'unknown'
    }
}

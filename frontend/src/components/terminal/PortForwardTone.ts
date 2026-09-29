import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TUiTone } from '@/components/common/status/types/TUiTone'
import type { TPortForwardStatus } from '@/domain/entities/portForward'

export class PortForwardTone {
    public static readonly tones: Record<TPortForwardStatus, TUiTone> = {
        starting: 'pending',
        active: 'ok',
        stopped: 'unknown',
        waiting: 'pending',
        reconnecting: 'warning',
        error: 'error',
    }

    public static of(status: TPortForwardStatus): TUiTone {
        return PortForwardTone.tones[status] ?? 'unknown'
    }

    public static summary(forwards: readonly TPortForward[]): TUiTone {
        if (forwards.some(forward => forward.status === 'error')) {
            return 'error'
        }
        if (forwards.some(forward => forward.status === 'reconnecting')) {
            return 'warning'
        }

        return forwards.some(forward => forward.status === 'active') ? 'ok' : 'unknown'
    }

    public static isAlarming(tone: TUiTone): boolean {
        return tone === 'error' || tone === 'warning'
    }
}

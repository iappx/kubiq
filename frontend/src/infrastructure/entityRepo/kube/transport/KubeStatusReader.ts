import { ApiError } from '@/domain/errors/ApiError'
import { KubeFailureCatalog } from '@/domain/models/kube/failure/KubeFailureCatalog'
import type { TKubeFailureKind } from '@/domain/models/kube/failure/types/TKubeFailureKind'
import type { TKubeStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStatus'

export class KubeStatusReader {
    public static readonly unreachable: string = KubeFailureCatalog.message('unreachable')

    public static readonly unauthorized: number = KubeFailureCatalog.unauthorized

    public static readonly forbidden: number = KubeFailureCatalog.forbidden

    public static readonly missing: number = KubeFailureCatalog.missing

    public static readonly conflict: number = KubeFailureCatalog.conflict

    public static readonly gone: number = KubeFailureCatalog.gone

    public static readonly throttled: number = KubeFailureCatalog.throttled

    public static readonly unavailable: number = KubeFailureCatalog.unavailable

    public static apiError(status: number, body: string, failure: string): ApiError {
        const kind = KubeFailureCatalog.kindOf(status, failure)
        const reported = KubeStatusReader.parse(body)

        return new ApiError(
            KubeStatusReader.messageOf(kind, reported),
            KubeStatusReader.details(reported, body, failure),
            status,
        )
    }

    public static kindOf(error: unknown): TKubeFailureKind {
        if (!(error instanceof ApiError) || error.status === undefined) {
            return 'unknown'
        }

        return KubeFailureCatalog.kindOf(error.status, error.details ?? '')
    }

    public static isUnauthorized(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.unauthorized
    }

    public static isForbidden(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.forbidden
    }

    public static isConflict(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.conflict
    }

    public static isGone(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.gone
    }

    public static isMissing(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.missing
    }

    public static isThrottled(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.throttled
    }

    public static isUnavailable(error: unknown): boolean {
        return ApiError.statusOf(error) === KubeStatusReader.unavailable
    }

    public static isAbsent(error: unknown): boolean {
        return KubeStatusReader.isMissing(error) || KubeStatusReader.isUnavailable(error)
    }

    public static parse(body: string): TKubeStatus | undefined {
        if (body === '') {
            return undefined
        }
        try {
            const parsed = JSON.parse(body) as TKubeStatus
            return parsed && typeof parsed === 'object' && parsed.kind === 'Status' ? parsed : undefined
        } catch {
            return undefined
        }
    }

    public static describe(status: number, failure: string = ''): string {
        return KubeFailureCatalog.describe(status, failure)
    }

    // The cluster's own prose names the user, the verb and the object, so it wins wherever it
    // exists — except where ours also says what to do, which the API server never does.
    protected static messageOf(kind: TKubeFailureKind, reported: TKubeStatus | undefined): string {
        const own = KubeFailureCatalog.message(kind)
        if (KubeFailureCatalog.needsReconnect(kind)) {
            return own
        }

        return reported && reported.message ? reported.message : own
    }

    protected static details(reported: TKubeStatus | undefined, body: string, failure: string): string | undefined {
        if (failure !== '') {
            return failure
        }
        if (reported && reported.reason) {
            return reported.reason
        }
        return body !== '' ? body : undefined
    }
}

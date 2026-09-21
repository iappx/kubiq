import { ApiError } from '@/domain/errors/ApiError'
import type { TKubeStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStatus'

export class KubeStatusReader {
    public static readonly unreachable: string = 'Could not reach the cluster'

    public static readonly forbidden: number = 403

    public static readonly missing: number = 404

    public static readonly conflict: number = 409

    public static readonly gone: number = 410

    public static apiError(status: number, body: string, failure: string): ApiError {
        const reported = KubeStatusReader.parse(body)
        const message = reported && reported.message ? reported.message : KubeStatusReader.describe(status)
        return new ApiError(message, KubeStatusReader.details(reported, body, failure), status)
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

    public static describe(status: number): string {
        if (status === 0) {
            return KubeStatusReader.unreachable
        }
        if (status === 401) {
            return 'The cluster rejected the credentials'
        }
        if (status === 403) {
            return 'The cluster denied access to this resource'
        }
        if (status === 404) {
            return 'The resource was not found in the cluster'
        }
        if (status === 409) {
            return 'The object has changed in the cluster since it was loaded'
        }
        if (status === 410) {
            return 'The cluster no longer keeps that resource version'
        }
        if (status === 422) {
            return 'The cluster rejected the object as invalid'
        }
        if (status >= 500) {
            return 'The cluster reported an internal error'
        }
        return 'The cluster request failed'
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

import { KubeNetworkFailure } from '@/domain/models/kube/failure/KubeNetworkFailure'
import type { TKubeFailureKind } from '@/domain/models/kube/failure/types/TKubeFailureKind'

export class KubeFailureCatalog {
    public static readonly unauthorized: number = 401

    public static readonly forbidden: number = 403

    public static readonly missing: number = 404

    public static readonly conflict: number = 409

    public static readonly gone: number = 410

    public static readonly invalid: number = 422

    public static readonly throttled: number = 429

    public static readonly unavailable: number = 503

    private static readonly messages: Record<TKubeFailureKind, string> = {
        unauthorized: 'The cluster rejected the credentials. Reconnect it from the catalog to sign in again.',
        forbidden: 'The cluster denied access to this resource',
        missing: 'The cluster does not serve this resource, or the object no longer exists.',
        conflict: 'The object has changed in the cluster since it was loaded',
        invalid: 'The cluster rejected the object as invalid',
        expired: 'The cluster no longer keeps that resource version',
        throttled: 'The cluster is rate limiting requests. It will accept them again in a moment.',
        unavailable: 'The cluster API is not available right now. It may still be starting up.',
        serverError: 'The cluster reported an internal error',
        timeout: 'The cluster did not answer in time.',
        tls: 'The certificate the cluster presented could not be verified.',
        unreachable: 'Could not reach the cluster',
        disconnected: 'The connection to this cluster is closed. Reconnect it from the catalog.',
        unknown: 'The cluster request failed',
    }

    private static readonly statuses: Record<number, TKubeFailureKind> = {
        401: 'unauthorized',
        403: 'forbidden',
        404: 'missing',
        409: 'conflict',
        410: 'expired',
        422: 'invalid',
        429: 'throttled',
        503: 'unavailable',
    }

    private static readonly reconnectable: readonly TKubeFailureKind[] = ['unauthorized', 'disconnected']

    private static readonly transient: readonly TKubeFailureKind[] = [
        'throttled',
        'unavailable',
        'serverError',
        'timeout',
        'unreachable',
    ]

    public static kindOf(status: number, failure: string = ''): TKubeFailureKind {
        if (status === 0) {
            return KubeNetworkFailure.kindOf(failure)
        }

        const known = KubeFailureCatalog.statuses[status]
        if (known) {
            return known
        }

        return status >= 500 ? 'serverError' : 'unknown'
    }

    public static message(kind: TKubeFailureKind): string {
        return KubeFailureCatalog.messages[kind] ?? KubeFailureCatalog.messages.unknown
    }

    public static describe(status: number, failure: string = ''): string {
        return KubeFailureCatalog.message(KubeFailureCatalog.kindOf(status, failure))
    }

    public static needsReconnect(kind: TKubeFailureKind): boolean {
        return KubeFailureCatalog.reconnectable.includes(kind)
    }

    public static isTransient(kind: TKubeFailureKind): boolean {
        return KubeFailureCatalog.transient.includes(kind)
    }
}

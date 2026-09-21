import type { TKubeFailureKind } from '@/domain/models/kube/failure/types/TKubeFailureKind'

export class KubeNetworkFailure {
    private static readonly closedMarkers: readonly string[] = [
        'unknown session',
        'unknown stream',
    ]

    // A dial that timed out is deliberately absent: reaching the host at all is what
    // failed there, so it belongs with the unreachable ones.
    private static readonly timeoutMarkers: readonly string[] = [
        'context deadline exceeded',
        'client.timeout exceeded',
        'timeout awaiting response headers',
        'tls handshake timeout',
    ]

    private static readonly tlsMarkers: readonly string[] = [
        'x509:',
        'tls:',
        'certificate',
        'unknown authority',
    ]

    // Order is load-bearing: 'net/http: TLS handshake timeout' carries both vocabularies
    // and is a timeout, so the timeout pass has to claim it first.
    public static kindOf(failure: string): TKubeFailureKind {
        const text = failure.toLowerCase()

        if (KubeNetworkFailure.matches(text, KubeNetworkFailure.closedMarkers)) {
            return 'disconnected'
        }
        if (KubeNetworkFailure.matches(text, KubeNetworkFailure.timeoutMarkers)) {
            return 'timeout'
        }
        if (KubeNetworkFailure.matches(text, KubeNetworkFailure.tlsMarkers)) {
            return 'tls'
        }

        return 'unreachable'
    }

    private static matches(text: string, markers: readonly string[]): boolean {
        return markers.some(marker => text.includes(marker))
    }
}

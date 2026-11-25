import type { TX509Validity } from '@/domain/models/certificate/types/TX509Validity'

export class X509ValidityCatalog {
    private static readonly labels: Record<TX509Validity, string> = {
        valid: 'Valid',
        expiring: 'Expiring soon',
        expired: 'Expired',
        'not-yet-valid': 'Not yet valid',
    }

    private static readonly severities: Record<TX509Validity, number> = {
        valid: 0,
        expiring: 1,
        'not-yet-valid': 2,
        expired: 3,
    }

    public static label(validity: TX509Validity): string {
        return X509ValidityCatalog.labels[validity]
    }

    public static state(validity: TX509Validity): 'ok' | 'warning' | 'error' {
        if (validity === 'expired' || validity === 'not-yet-valid') {
            return 'error'
        }

        return validity === 'expiring' ? 'warning' : 'ok'
    }

    public static worst(values: readonly TX509Validity[]): TX509Validity {
        let worst: TX509Validity = 'valid'

        for (const value of values) {
            if (X509ValidityCatalog.severities[value] > X509ValidityCatalog.severities[worst]) {
                worst = value
            }
        }

        return worst
    }
}

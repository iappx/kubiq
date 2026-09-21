export class MetricQuantity {
    private static readonly pattern: RegExp = /^([+-]?\d+(?:\.\d+)?)(m|n|u|k|K|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei|[eE][+-]?\d+)?$/

    private static readonly multipliers: Record<string, number> = {
        n: 1e-9,
        u: 1e-6,
        m: 1e-3,
        k: 1e3,
        K: 1e3,
        M: 1e6,
        G: 1e9,
        T: 1e12,
        P: 1e15,
        E: 1e18,
        Ki: 1024,
        Mi: 1024 ** 2,
        Gi: 1024 ** 3,
        Ti: 1024 ** 4,
        Pi: 1024 ** 5,
        Ei: 1024 ** 6,
    }

    public static parse(value: unknown): number {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0
        }
        if (typeof value !== 'string') {
            return 0
        }

        const match = MetricQuantity.pattern.exec(value.trim())
        if (!match) {
            return 0
        }

        const amount = Number(match[1])
        if (!Number.isFinite(amount)) {
            return 0
        }

        return amount * MetricQuantity.factor(match[2])
    }

    public static ratio(used: number, total: number): number {
        return total > 0 ? used / total : 0
    }

    public static sum(values: readonly unknown[]): number {
        return values.reduce<number>((total, value) => total + MetricQuantity.parse(value), 0)
    }

    private static factor(suffix: string | undefined): number {
        if (suffix === undefined || suffix === '') {
            return 1
        }
        if (suffix[0] === 'e' || (suffix[0] === 'E' && suffix.length > 1)) {
            return 10 ** Number(suffix.slice(1))
        }

        return MetricQuantity.multipliers[suffix] ?? 1
    }
}

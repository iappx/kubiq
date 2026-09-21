// Kubernetes ranks maturity before number: v2 > v1 > v2beta1 > v1beta2 > v1beta1 > v1alpha1.
export class KubeVersionComparer {
    private static readonly pattern: RegExp = /^v(\d+)(?:(alpha|beta)(\d+))?$/

    private static readonly stageRanks: Record<string, number> = {
        ga: 3,
        beta: 2,
        alpha: 1,
    }

    public static compare(left: string, right: string): number {
        const a = KubeVersionComparer.parse(left)
        const b = KubeVersionComparer.parse(right)
        if (!a && !b) {
            return left.localeCompare(right)
        }
        if (!a) {
            return 1
        }
        if (!b) {
            return -1
        }
        if (a.stage !== b.stage) {
            return b.stage - a.stage
        }
        if (a.major !== b.major) {
            return b.major - a.major
        }
        return b.minor - a.minor
    }

    public static sort(versions: string[]): string[] {
        return [...versions].sort((a, b) => KubeVersionComparer.compare(a, b))
    }

    public static best(versions: string[]): string | undefined {
        const known = versions.filter(p => typeof p === 'string' && p.length > 0)
        return known.length > 0 ? KubeVersionComparer.sort(known)[0] : undefined
    }

    private static parse(version: string): { stage: number; major: number; minor: number } | undefined {
        const match = KubeVersionComparer.pattern.exec(version ?? '')
        if (!match) {
            return undefined
        }
        const stageName = match[2] ?? 'ga'
        return {
            stage: KubeVersionComparer.stageRanks[stageName],
            major: Number(match[1]),
            minor: match[3] ? Number(match[3]) : 0,
        }
    }
}

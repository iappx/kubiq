export class AppVersion {
    private static readonly pattern = /^v?(\d+)\.(\d+)\.(\d+)$/i

    private constructor(
        public readonly major: number,
        public readonly minor: number,
        public readonly patch: number,
    ) {}

    public static parse(value: string): AppVersion | null {
        const match = AppVersion.pattern.exec((value ?? '').trim())
        if (!match) {
            return null
        }

        return new AppVersion(Number(match[1]), Number(match[2]), Number(match[3]))
    }

    public static isNewer(candidate: string, current: string): boolean {
        const next = AppVersion.parse(candidate)
        const installed = AppVersion.parse(current)

        return !!next && !!installed && next.compare(installed) > 0
    }

    public compare(other: AppVersion): number {
        return this.major - other.major || this.minor - other.minor || this.patch - other.patch
    }

    public toString(): string {
        return `${this.major}.${this.minor}.${this.patch}`
    }
}

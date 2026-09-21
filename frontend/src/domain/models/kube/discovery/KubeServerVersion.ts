import type { TKubeVersionDocument } from '@/domain/models/kube/discovery/types/TKubeVersionDocument'

export class KubeServerVersion {
    public static readonly unknownText: string = 'Unknown version'

    // Managed distributions report a minor of "30+", and only the digits rank.
    private static readonly leadingDigits: RegExp = /^\d+/

    private static readonly gitVersion: RegExp = /^v?(\d+)\.(\d+)/

    public readonly major: number

    public readonly minor: number

    public readonly text: string

    constructor(major: number, minor: number, text: string) {
        this.major = major
        this.minor = minor
        this.text = text
    }

    public static unknown(): KubeServerVersion {
        return new KubeServerVersion(0, 0, KubeServerVersion.unknownText)
    }

    public static read(document: TKubeVersionDocument | undefined | null): KubeServerVersion {
        if (!document) {
            return KubeServerVersion.unknown()
        }

        const fromGit = KubeServerVersion.gitVersion.exec(document.gitVersion ?? '')
        const major = KubeServerVersion.number(document.major) ?? Number(fromGit?.[1] ?? Number.NaN)
        const minor = KubeServerVersion.number(document.minor) ?? Number(fromGit?.[2] ?? Number.NaN)

        if (!Number.isFinite(major) || !Number.isFinite(minor)) {
            return KubeServerVersion.unknown()
        }

        return new KubeServerVersion(major, minor, KubeServerVersion.label(document, major, minor))
    }

    public get isKnown(): boolean {
        return this.major > 0 || this.minor > 0
    }

    public get short(): string {
        return this.isKnown ? `${this.major}.${this.minor}` : KubeServerVersion.unknownText
    }

    public atLeast(major: number, minor: number): boolean {
        if (!this.isKnown) {
            return false
        }
        return this.major !== major ? this.major > major : this.minor >= minor
    }

    private static label(document: TKubeVersionDocument, major: number, minor: number): string {
        const git = (document.gitVersion ?? '').trim()
        return git.length > 0 ? git : `v${major}.${minor}`
    }

    private static number(value: string | undefined): number | undefined {
        const digits = KubeServerVersion.leadingDigits.exec((value ?? '').trim())
        return digits ? Number(digits[0]) : undefined
    }
}

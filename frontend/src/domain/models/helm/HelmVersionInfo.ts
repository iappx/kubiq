export class HelmVersionInfo {
    public static readonly MinimumMajor: number = 3

    public static parse(output: string): string {
        const match = /v?\d+\.\d+(\.\d+)?[^\s]*/.exec(output.trim())

        return match ? match[0] : output.trim()
    }

    public static majorOf(version: string): number {
        const match = /^v?(\d+)/.exec(version.trim())

        return match ? Number.parseInt(match[1], 10) : 0
    }

    public static isSupported(version: string): boolean {
        return HelmVersionInfo.majorOf(version) >= HelmVersionInfo.MinimumMajor
    }

    public static unsupportedReason(version: string): string {
        return `Kubiq drives Helm ${HelmVersionInfo.MinimumMajor} and newer; the executable reports ${version || 'no version'}`
    }
}

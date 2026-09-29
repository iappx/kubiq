export class ClusterIconFile {
    public static readonly directory: string = 'userdata:clusters/icons'

    public static readonly maxBytes: number = 1024 * 1024

    public static readonly unsupported: string = 'Choose a PNG, JPG or SVG image'

    public static readonly tooLarge: string = 'That image is larger than 1 MB — choose a smaller one'

    public static readonly missing: string = 'That image could not be read'

    private static readonly types: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
    }

    private static readonly nameLimit: number = 48

    public static get pattern(): string {
        return Object.keys(ClusterIconFile.types).map(extension => `*.${extension}`).join(';')
    }

    public static isSupported(path: string): boolean {
        return ClusterIconFile.mimeOf(path) !== ''
    }

    public static mimeOf(path: string): string {
        const extension = ClusterIconFile.extensionOf(path)

        return Object.prototype.hasOwnProperty.call(ClusterIconFile.types, extension)
            ? ClusterIconFile.types[extension]
            : ''
    }

    public static pathFor(clusterId: string, source: string, at: number): string {
        const slug = clusterId
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .slice(0, ClusterIconFile.nameLimit)
            .replace(/^[-.]+|[-.]+$/g, '') || 'cluster'

        return `${ClusterIconFile.directory}/${slug}-${at.toString(36)}.${ClusterIconFile.extensionOf(source)}`
    }

    public static urlOf(path: string, base64: string): string {
        return `data:${ClusterIconFile.mimeOf(path)};base64,${base64}`
    }

    public static nameOf(path: string): string {
        const separator = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

        return separator < 0 ? path : path.slice(separator + 1)
    }

    private static extensionOf(path: string): string {
        const name = ClusterIconFile.nameOf(path)
        const dot = name.lastIndexOf('.')

        return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
    }
}

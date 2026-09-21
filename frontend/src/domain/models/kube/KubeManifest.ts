export class KubeManifest {
    public static readonly apiVersionKey: string = 'apiVersion'

    public static readonly kindKey: string = 'kind'

    public static readonly metadataKey: string = 'metadata'

    public static readonly statusKey: string = 'status'

    public static apiVersionOf(document: Record<string, unknown>): string {
        return KubeManifest.text(document[KubeManifest.apiVersionKey])
    }

    public static kindOf(document: Record<string, unknown>): string {
        return KubeManifest.text(document[KubeManifest.kindKey])
    }

    public static metadataOf(document: Record<string, unknown>): Record<string, unknown> {
        return KubeManifest.isObject(document[KubeManifest.metadataKey])
            ? document[KubeManifest.metadataKey] as Record<string, unknown>
            : {}
    }

    public static nameOf(document: Record<string, unknown>): string {
        return KubeManifest.text(KubeManifest.metadataOf(document).name)
    }

    public static generateNameOf(document: Record<string, unknown>): string {
        return KubeManifest.text(KubeManifest.metadataOf(document).generateName)
    }

    public static namespaceOf(document: Record<string, unknown>): string {
        return KubeManifest.text(KubeManifest.metadataOf(document).namespace)
    }

    public static uidOf(document: Record<string, unknown>): string {
        return KubeManifest.text(KubeManifest.metadataOf(document).uid)
    }

    public static resourceVersionOf(document: Record<string, unknown>): string {
        return KubeManifest.text(KubeManifest.metadataOf(document).resourceVersion)
    }

    public static withResourceVersion(
        document: Record<string, unknown>,
        resourceVersion: string,
    ): Record<string, unknown> {
        return {
            ...document,
            [KubeManifest.metadataKey]: { ...KubeManifest.metadataOf(document), resourceVersion },
        }
    }

    // managedFields is apply bookkeeping nobody edits, and the API server rebuilds it, so dropping it is safe.
    public static readable(document: Record<string, unknown>): Record<string, unknown> {
        const metadata = { ...KubeManifest.metadataOf(document) }
        delete metadata.managedFields

        return { ...document, [KubeManifest.metadataKey]: metadata }
    }

    public static isObject(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === 'object' && !Array.isArray(value)
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}

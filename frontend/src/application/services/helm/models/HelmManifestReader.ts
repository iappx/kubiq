import { parseAllDocuments } from 'yaml'
import type { THelmManifestResource } from '@/application/services/helm/types/THelmManifestResource'

export class HelmManifestReader {
    public static resources(manifest: string, fallbackNamespace: string): THelmManifestResource[] {
        if (manifest.trim() === '') {
            return []
        }

        const found: THelmManifestResource[] = []

        parseAllDocuments(manifest).forEach((document) => {
            // Skipped, not thrown: one unreadable document must not cost the rest of the manifest.
            if (document.errors.length > 0) {
                return
            }

            const object = document.toJS() as Record<string, any> | null
            const resource = HelmManifestReader.resourceOf(object, fallbackNamespace)
            if (resource) {
                found.push(resource)
            }
        })

        return found
    }

    private static resourceOf(
        object: Record<string, any> | null,
        fallbackNamespace: string,
    ): THelmManifestResource | null {
        if (!object || typeof object !== 'object') {
            return null
        }

        const kind = HelmManifestReader.text(object.kind)
        const name = HelmManifestReader.text(object.metadata?.name)
        if (kind === '' || name === '') {
            return null
        }

        return {
            apiVersion: HelmManifestReader.text(object.apiVersion),
            kind,
            name,
            namespace: HelmManifestReader.text(object.metadata?.namespace) || fallbackNamespace,
        }
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}

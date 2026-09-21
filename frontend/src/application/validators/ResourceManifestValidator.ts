import { injectable } from 'tsyringe'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import type { TResourceManifestDraft } from '@/application/services/resourceYaml/types/TResourceManifestDraft'
import { KubeKindLocator, KubeManifest, KubeResourceRegistry } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class ResourceManifestValidator {
    public validate(draft: TResourceManifestDraft): TValidationResult {
        const errors: Record<string, string> = {}
        const text = draft.manifest.trim()

        if (text.length === 0) {
            return { valid: false, errors: { manifest: 'Paste the manifest of the object to create' } }
        }

        const parsed = YamlDocument.tryParse(draft.manifest)
        if (parsed.error !== '') {
            return { valid: false, errors: { manifest: parsed.detail === '' ? parsed.error : `${parsed.error}. ${parsed.detail}` } }
        }

        const apiVersion = KubeManifest.apiVersionOf(parsed.document)
        const kindName = KubeManifest.kindOf(parsed.document)
        const missing: string[] = []

        if (apiVersion === '') {
            missing.push('apiVersion, for example apps/v1')
        }
        if (kindName === '') {
            missing.push('kind, for example Deployment')
        }
        if (KubeManifest.nameOf(parsed.document) === '' && KubeManifest.generateNameOf(parsed.document) === '') {
            missing.push('metadata.name, so the object has something to be called')
        }
        if (missing.length > 0) {
            errors.manifest = `The manifest is missing ${missing.join('; ')}`

            return { valid: false, errors }
        }

        return ResourceManifestValidator.checkKind(draft.served, apiVersion, kindName)
    }

    // Served kinds win over the registry: a kind exists because the cluster serves it.
    public static locate(
        served: readonly KubeResourceKind[],
        apiVersion: string,
        kindName: string,
    ): KubeResourceKind | undefined {
        return KubeKindLocator.find(served, apiVersion, kindName)
            ?? KubeKindLocator.find(KubeResourceRegistry.all(), apiVersion, kindName)
    }

    private static checkKind(
        served: readonly KubeResourceKind[],
        apiVersion: string,
        kindName: string,
    ): TValidationResult {
        const kind = ResourceManifestValidator.locate(served, apiVersion, kindName)

        if (!kind) {
            return {
                valid: false,
                errors: { manifest: `This cluster does not serve ${KubeKindLocator.describe(apiVersion, kindName)}` },
            }
        }
        if (!kind.canCreate) {
            return {
                valid: false,
                errors: { manifest: `You cannot create ${kind.title} in this cluster` },
            }
        }

        return { valid: true, errors: {} }
    }
}

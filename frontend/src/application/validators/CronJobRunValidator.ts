import { injectable } from 'tsyringe'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import type { TCronJobRunDraft } from '@/application/services/workloadAction/types/TCronJobRunDraft'
import { KubeManifest } from '@/domain/models/kube'
import type { TValidationResult } from '@/lib/validation/types/TValidationResult'

@injectable()
export class CronJobRunValidator {
    public validate(draft: TCronJobRunDraft): TValidationResult {
        if (draft.manifest.trim().length === 0) {
            return { valid: false, errors: { manifest: 'Write the manifest of the job to run' } }
        }

        const parsed = YamlDocument.tryParse(draft.manifest)
        if (parsed.error !== '') {
            return { valid: false, errors: { manifest: parsed.detail === '' ? parsed.error : `${parsed.error}. ${parsed.detail}` } }
        }

        const document = parsed.document
        const problems: string[] = []

        if (KubeManifest.apiVersionOf(document) !== draft.jobKind.apiVersion || KubeManifest.kindOf(document) !== draft.jobKind.kind) {
            problems.push(`it must describe a ${draft.jobKind.kind} of ${draft.jobKind.apiVersion}`)
        }
        if (KubeManifest.nameOf(document) === '' && KubeManifest.generateNameOf(document) === '') {
            problems.push('it needs metadata.name or metadata.generateName')
        }

        const namespace = KubeManifest.namespaceOf(document)
        if (namespace !== '' && namespace !== draft.namespace) {
            problems.push(`the job runs in ${draft.namespace}, the namespace of its cron job, not in ${namespace}`)
        }

        return problems.length === 0
            ? { valid: true, errors: {} }
            : { valid: false, errors: { manifest: `The manifest cannot run: ${problems.join('; ')}` } }
    }
}

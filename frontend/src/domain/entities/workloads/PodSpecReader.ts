import { KubeManifest } from '@/domain/models/kube/KubeManifest'
import type { TPodSpec } from '@/domain/entities/workloads/types/TPodSpec'

export class PodSpecReader {
    public static of(object: Record<string, unknown>): TPodSpec {
        const spec = KubeManifest.isObject(object.spec) ? object.spec : {}
        if (Array.isArray(spec.containers)) {
            return spec as TPodSpec
        }

        const template = KubeManifest.isObject(spec.template) ? spec.template : {}
        const templated = KubeManifest.isObject(template.spec) ? template.spec : {}
        if (Array.isArray(templated.containers)) {
            return templated as TPodSpec
        }

        const jobTemplate = KubeManifest.isObject(spec.jobTemplate) ? spec.jobTemplate : {}
        const jobSpec = KubeManifest.isObject(jobTemplate.spec) ? jobTemplate.spec : {}
        const jobPodTemplate = KubeManifest.isObject(jobSpec.template) ? jobSpec.template : {}

        return KubeManifest.isObject(jobPodTemplate.spec) ? jobPodTemplate.spec as TPodSpec : {}
    }
}

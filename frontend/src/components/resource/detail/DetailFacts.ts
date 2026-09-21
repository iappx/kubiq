import type { TDetailFact } from '@/components/resource/detail/types/TDetailFact'
import { KubeManifest } from '@/domain/models/kube'
import type { KubeResourceKind } from '@/domain/models/kube'

export class DetailFacts {
    public static of(object: Record<string, unknown>, kind: KubeResourceKind | null): TDetailFact[] {
        const metadata = KubeManifest.metadataOf(object)
        const facts: TDetailFact[] = [
            { label: 'Kind', value: KubeManifest.kindOf(object) || (kind?.kind ?? '') },
            { label: 'API version', value: KubeManifest.apiVersionOf(object) || (kind?.apiVersion ?? '') },
            { label: 'Name', value: KubeManifest.nameOf(object) },
        ]

        const namespace = KubeManifest.namespaceOf(object)
        if (namespace !== '') {
            facts.push({ label: 'Namespace', value: namespace })
        }

        DetailFacts.push(facts, 'Node', DetailFacts.spec(object).nodeName)
        DetailFacts.push(facts, 'Pod IP', DetailFacts.status(object).podIP)
        DetailFacts.push(facts, 'Phase', DetailFacts.status(object).phase)
        DetailFacts.push(facts, 'Service account', DetailFacts.spec(object).serviceAccountName)
        DetailFacts.push(facts, 'UID', metadata.uid)
        DetailFacts.push(facts, 'Resource version', metadata.resourceVersion)

        const created = KubeManifest.metadataOf(object).creationTimestamp
        if (typeof created === 'string' && created !== '') {
            facts.push({ label: 'Created', value: created, isAge: true })
        }

        DetailFacts.push(facts, 'Deleting since', metadata.deletionTimestamp)

        return facts
    }

    public static labelsOf(object: Record<string, unknown>): Record<string, string> {
        return DetailFacts.strings(KubeManifest.metadataOf(object).labels)
    }

    public static annotationsOf(object: Record<string, unknown>): Record<string, string> {
        return DetailFacts.strings(KubeManifest.metadataOf(object).annotations)
    }

    private static strings(value: unknown): Record<string, string> {
        if (!KubeManifest.isObject(value)) {
            return {}
        }

        const pairs: Record<string, string> = {}
        Object.keys(value).forEach((key) => {
            pairs[key] = typeof value[key] === 'string' ? value[key] as string : JSON.stringify(value[key])
        })

        return pairs
    }

    private static spec(object: Record<string, unknown>): Record<string, unknown> {
        return KubeManifest.isObject(object.spec) ? object.spec : {}
    }

    private static status(object: Record<string, unknown>): Record<string, unknown> {
        return KubeManifest.isObject(object.status) ? object.status : {}
    }

    private static push(facts: TDetailFact[], label: string, value: unknown): void {
        if (typeof value === 'string' && value !== '') {
            facts.push({ label, value })
        }
    }
}

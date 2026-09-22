import { PodSpecReader } from '@/domain/entities/workloads/PodSpecReader'
import type { TKubeContainer } from '@/domain/entities/workloads/types/TKubeContainer'
import type { TKubeEnvFromSource } from '@/domain/entities/workloads/types/TKubeEnvFromSource'
import type { TKubeEnvKeyRef } from '@/domain/entities/workloads/types/TKubeEnvKeyRef'
import type { TKubeEnvVar } from '@/domain/entities/workloads/types/TKubeEnvVar'
import type { TPodContainerEnvironment } from '@/domain/entities/workloads/types/TPodContainerEnvironment'
import type { TPodEnvironmentImport } from '@/domain/entities/workloads/types/TPodEnvironmentImport'
import type { TPodEnvironmentKeyRef } from '@/domain/entities/workloads/types/TPodEnvironmentKeyRef'
import type { TPodEnvironmentObjectRef } from '@/domain/entities/workloads/types/TPodEnvironmentObjectRef'
import type { TPodEnvironmentSourceKind } from '@/domain/entities/workloads/types/TPodEnvironmentSourceKind'
import type { TPodEnvironmentVariable } from '@/domain/entities/workloads/types/TPodEnvironmentVariable'

export class PodEnvironmentPlan {
    public static of(object: Record<string, unknown>): TPodContainerEnvironment[] {
        const spec = PodSpecReader.of(object)

        return [
            ...PodEnvironmentPlan.group(spec.initContainers, true),
            ...PodEnvironmentPlan.group(spec.containers, false),
        ]
    }

    public static referencesOf(plans: readonly TPodContainerEnvironment[]): TPodEnvironmentObjectRef[] {
        const found = new Map<string, TPodEnvironmentObjectRef>()

        for (const plan of plans) {
            for (const entry of plan.imports) {
                found.set(PodEnvironmentPlan.keyOf(entry.object), entry.object)
            }

            for (const variable of plan.variables) {
                const reference = variable.reference
                if (reference) {
                    found.set(PodEnvironmentPlan.keyOf(reference.object), reference.object)
                }
            }
        }

        return [...found.values()]
    }

    public static keyOf(object: TPodEnvironmentObjectRef): string {
        return `${object.sourceKind}/${object.name}`
    }

    private static group(containers: TKubeContainer[] | undefined, isInit: boolean): TPodContainerEnvironment[] {
        const groups: TPodContainerEnvironment[] = []

        for (const container of containers ?? []) {
            const name = PodEnvironmentPlan.text(container?.name)
            if (name === '') {
                continue
            }

            groups.push({
                container: name,
                isInit,
                imports: PodEnvironmentPlan.imports(container.envFrom),
                variables: PodEnvironmentPlan.variables(container.env),
            })
        }

        return groups
    }

    private static imports(sources: TKubeEnvFromSource[] | undefined): TPodEnvironmentImport[] {
        const imports: TPodEnvironmentImport[] = []

        for (const source of sources ?? []) {
            const fromConfigMap = PodEnvironmentPlan.objectRef('configMap', source?.configMapRef?.name)
            const reference = fromConfigMap ?? PodEnvironmentPlan.objectRef('secret', source?.secretRef?.name)
            if (!reference) {
                continue
            }

            const declared = fromConfigMap ? source.configMapRef : source.secretRef

            imports.push({
                prefix: PodEnvironmentPlan.text(source.prefix),
                object: reference,
                optional: declared?.optional === true,
            })
        }

        return imports
    }

    private static variables(env: TKubeEnvVar[] | undefined): TPodEnvironmentVariable[] {
        const variables: TPodEnvironmentVariable[] = []

        for (const entry of env ?? []) {
            const name = PodEnvironmentPlan.text(entry?.name)
            if (name === '') {
                continue
            }

            variables.push(PodEnvironmentPlan.describe(name, entry))
        }

        return variables
    }

    private static describe(name: string, entry: TKubeEnvVar): TPodEnvironmentVariable {
        const from = entry.valueFrom

        const reference = PodEnvironmentPlan.keyRef('configMap', from?.configMapKeyRef)
            ?? PodEnvironmentPlan.keyRef('secret', from?.secretKeyRef)
        if (reference) {
            return { name, origin: 'reference', value: '', container: '', reference }
        }

        if (from?.fieldRef) {
            return {
                name,
                origin: 'field',
                value: PodEnvironmentPlan.text(from.fieldRef.fieldPath),
                container: '',
                reference: null,
            }
        }

        if (from?.resourceFieldRef) {
            return {
                name,
                origin: 'resourceField',
                value: PodEnvironmentPlan.text(from.resourceFieldRef.resource),
                container: PodEnvironmentPlan.text(from.resourceFieldRef.containerName),
                reference: null,
            }
        }

        return { name, origin: 'literal', value: PodEnvironmentPlan.text(entry.value), container: '', reference: null }
    }

    private static keyRef(
        sourceKind: TPodEnvironmentSourceKind,
        ref: TKubeEnvKeyRef | undefined,
    ): TPodEnvironmentKeyRef | null {
        const object = PodEnvironmentPlan.objectRef(sourceKind, ref?.name)

        return object === null
            ? null
            : { object, key: PodEnvironmentPlan.text(ref?.key), optional: ref?.optional === true }
    }

    private static objectRef(
        sourceKind: TPodEnvironmentSourceKind,
        name: unknown,
    ): TPodEnvironmentObjectRef | null {
        const text = PodEnvironmentPlan.text(name)

        return text === '' ? null : { sourceKind, name: text }
    }

    private static text(value: unknown): string {
        return typeof value === 'string' ? value : ''
    }
}

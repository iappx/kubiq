import { PodEnvironmentSources } from '@/application/services/podEnvironment/models/PodEnvironmentSources'
import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'
import type {
    TPodContainerEnvironment,
    TPodEnvironmentImport,
    TPodEnvironmentKeyRef,
    TPodEnvironmentObjectRef,
    TPodEnvironmentSourceKind,
    TPodEnvironmentVariable,
} from '@/domain/entities/workloads'

export class PodEnvironmentReport {
    public static readonly fieldSource: string = 'fieldRef'

    public static readonly resourceFieldSource: string = 'resourceFieldRef'

    public static of(
        plans: readonly TPodContainerEnvironment[],
        sources: PodEnvironmentSources,
    ): TPodEnvironmentGroup[] {
        return plans.map(plan => ({
            container: plan.container,
            isInit: plan.isInit,
            entries: PodEnvironmentReport.entries(plan, sources),
        }))
    }

    // envFrom is applied before env, so the imported block comes first and a variable that
    // env declares a second time is read further down, exactly as the kubelet builds it.
    private static entries(plan: TPodContainerEnvironment, sources: PodEnvironmentSources): TPodEnvironmentEntry[] {
        const built: Omit<TPodEnvironmentEntry, 'id'>[] = []

        for (const reference of plan.imports) {
            built.push(...PodEnvironmentReport.imported(reference, sources))
        }

        for (const variable of plan.variables) {
            built.push(PodEnvironmentReport.declared(variable, sources))
        }

        return built.map((entry, index) => ({ ...entry, id: `${plan.container}/${index}/${entry.variable}` }))
    }

    private static imported(
        reference: TPodEnvironmentImport,
        sources: PodEnvironmentSources,
    ): Omit<TPodEnvironmentEntry, 'id'>[] {
        const source = sources.of(reference.object)
        if (source.state !== 'read') {
            return [{
                variable: '',
                value: '',
                provenance: PodEnvironmentReport.describe(reference.object, ''),
                masked: false,
                state: source.state === 'forbidden' ? 'forbidden' : 'unresolved',
            }]
        }

        return sources.keysOf(reference.object).map((key): Omit<TPodEnvironmentEntry, 'id'> => ({
            variable: `${reference.prefix}${key}`,
            value: sources.valueOf(reference.object, key),
            provenance: PodEnvironmentReport.describe(reference.object, key),
            masked: PodEnvironmentReport.isSecret(reference.object),
            state: 'resolved',
        }))
    }

    private static declared(
        variable: TPodEnvironmentVariable,
        sources: PodEnvironmentSources,
    ): Omit<TPodEnvironmentEntry, 'id'> {
        const reference = variable.reference
        if (reference) {
            return PodEnvironmentReport.resolved(variable.name, reference, sources)
        }

        if (variable.origin === 'field') {
            return {
                variable: variable.name,
                value: variable.value,
                provenance: PodEnvironmentReport.fieldSource,
                masked: false,
                state: 'path',
            }
        }

        if (variable.origin === 'resourceField') {
            return {
                variable: variable.name,
                value: variable.value,
                provenance: variable.container === ''
                    ? PodEnvironmentReport.resourceFieldSource
                    : `${PodEnvironmentReport.resourceFieldSource} · ${variable.container}`,
                masked: false,
                state: 'path',
            }
        }

        return { variable: variable.name, value: variable.value, provenance: '', masked: false, state: 'literal' }
    }

    private static resolved(
        name: string,
        reference: TPodEnvironmentKeyRef,
        sources: PodEnvironmentSources,
    ): Omit<TPodEnvironmentEntry, 'id'> {
        const provenance = PodEnvironmentReport.describe(reference.object, reference.key)
        const source = sources.of(reference.object)

        if (source.state === 'forbidden') {
            return { variable: name, value: '', provenance, masked: false, state: 'forbidden' }
        }

        if (source.state !== 'read' || !sources.has(reference.object, reference.key)) {
            return { variable: name, value: '', provenance, masked: false, state: 'unresolved' }
        }

        return {
            variable: name,
            value: sources.valueOf(reference.object, reference.key),
            provenance,
            masked: PodEnvironmentReport.isSecret(reference.object),
            state: 'resolved',
        }
    }

    private static describe(object: TPodEnvironmentObjectRef, key: string): string {
        const named = `${PodEnvironmentReport.resourceOf(object.sourceKind)}/${object.name}`

        return key === '' ? named : `${named} · key: ${key}`
    }

    private static resourceOf(sourceKind: TPodEnvironmentSourceKind): string {
        return sourceKind === 'secret' ? 'secret' : 'configmap'
    }

    private static isSecret(object: TPodEnvironmentObjectRef): boolean {
        return object.sourceKind === 'secret'
    }
}

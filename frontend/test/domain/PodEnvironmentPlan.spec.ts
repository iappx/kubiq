import { describe, expect, it } from 'vitest'
import { PodEnvironmentPlan } from '@/domain/entities/workloads'

const pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name: 'api-7d9-abcde', namespace: 'payments' },
    spec: {
        initContainers: [
            {
                name: 'migrate',
                env: [{ name: 'MODE', value: 'up' }],
                envFrom: [{ secretRef: { name: 'db-creds' } }],
            },
        ],
        containers: [
            {
                name: 'api',
                env: [
                    { name: 'LOG_LEVEL', value: 'debug' },
                    { name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } },
                    { name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: 'db-creds', key: 'password', optional: true } } },
                    { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } },
                    { name: 'CPU_LIMIT', valueFrom: { resourceFieldRef: { resource: 'limits.cpu', containerName: 'api' } } },
                ],
                envFrom: [{ prefix: 'FEATURE_', configMapRef: { name: 'feature-flags', optional: true } }],
            },
        ],
    },
}

describe('PodEnvironmentPlan.of', () => {
    it('puts init containers before the rest and flags which is which', () => {
        expect(PodEnvironmentPlan.of(pod).map(plan => [plan.container, plan.isInit])).toEqual([
            ['migrate', true],
            ['api', false],
        ])
    })

    it('keeps the variables of a container in the order the spec declares them', () => {
        const api = PodEnvironmentPlan.of(pod)[1]

        expect(api.variables.map(variable => variable.name)).toEqual([
            'LOG_LEVEL',
            'APP_URL',
            'DB_PASSWORD',
            'NODE_NAME',
            'CPU_LIMIT',
        ])
    })

    it('reads a literal as a value that needs nothing else', () => {
        expect(PodEnvironmentPlan.of(pod)[1].variables[0]).toEqual({
            name: 'LOG_LEVEL',
            origin: 'literal',
            value: 'debug',
            container: '',
            reference: null,
        })
    })

    it('reads a configMapKeyRef as a reference to resolve', () => {
        expect(PodEnvironmentPlan.of(pod)[1].variables[1].reference).toEqual({
            object: { sourceKind: 'configMap', name: 'app-config' },
            key: 'url',
            optional: false,
        })
    })

    it('carries the optional flag of a secretKeyRef', () => {
        expect(PodEnvironmentPlan.of(pod)[1].variables[2].reference).toEqual({
            object: { sourceKind: 'secret', name: 'db-creds' },
            key: 'password',
            optional: true,
        })
    })

    it('keeps a fieldRef as a path rather than pretending it has a value', () => {
        expect(PodEnvironmentPlan.of(pod)[1].variables[3]).toMatchObject({
            origin: 'field',
            value: 'spec.nodeName',
            reference: null,
        })
    })

    it('keeps the container a resourceFieldRef measures', () => {
        expect(PodEnvironmentPlan.of(pod)[1].variables[4]).toMatchObject({
            origin: 'resourceField',
            value: 'limits.cpu',
            container: 'api',
        })
    })

    it('reads envFrom as a whole-map import with its prefix', () => {
        expect(PodEnvironmentPlan.of(pod)[1].imports).toEqual([{
            prefix: 'FEATURE_',
            object: { sourceKind: 'configMap', name: 'feature-flags' },
            optional: true,
        }])
    })

    it('leaves the prefix empty when envFrom names none', () => {
        expect(PodEnvironmentPlan.of(pod)[0].imports[0]).toEqual({
            prefix: '',
            object: { sourceKind: 'secret', name: 'db-creds' },
            optional: false,
        })
    })

    it('ignores a container, a variable and a reference that carry no name', () => {
        const broken = {
            spec: {
                containers: [
                    { name: '', env: [{ name: 'KEPT', value: 'x' }] },
                    {
                        name: 'api',
                        env: [
                            { value: 'nameless' },
                            { name: 'NO_SOURCE', valueFrom: { configMapKeyRef: { key: 'url' } } },
                        ],
                        envFrom: [{ configMapRef: {} }],
                    },
                ],
            },
        }

        const plans = PodEnvironmentPlan.of(broken)

        expect(plans.map(plan => plan.container)).toEqual(['api'])
        expect(plans[0].variables.map(variable => variable.name)).toEqual(['NO_SOURCE'])
        expect(plans[0].variables[0].origin).toBe('literal')
        expect(plans[0].imports).toEqual([])
    })

    it('finds nothing in an object that carries no spec', () => {
        expect(PodEnvironmentPlan.of({ kind: 'Pod' })).toEqual([])
    })
})

describe('PodEnvironmentPlan.of on a workload', () => {
    const template = {
        spec: {
            initContainers: [{ name: 'migrate', env: [{ name: 'MODE', value: 'up' }] }],
            containers: [{
                name: 'api',
                env: [{ name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } }],
                envFrom: [{ prefix: 'FEATURE_', configMapRef: { name: 'feature-flags' } }],
            }],
        },
    }

    const templated = (kind: string, spec: Record<string, unknown>) => ({ apiVersion: 'apps/v1', kind, spec })

    const read = (object: Record<string, unknown>) => {
        const plans = PodEnvironmentPlan.of(object)

        return {
            containers: plans.map(plan => [plan.container, plan.isInit]),
            variables: plans.flatMap(plan => plan.variables.map(variable => variable.name)),
            imports: plans.flatMap(plan => plan.imports.map(entry => entry.object.name)),
        }
    }

    const expected = {
        containers: [['migrate', true], ['api', false]],
        variables: ['MODE', 'APP_URL'],
        imports: ['feature-flags'],
    }

    it('reads the pod template of a Deployment', () => {
        expect(read(templated('Deployment', { replicas: 3, template }))).toEqual(expected)
    })

    it('reads the pod template of a StatefulSet', () => {
        expect(read(templated('StatefulSet', { serviceName: 'api', template }))).toEqual(expected)
    })

    it('reads the pod template of a DaemonSet', () => {
        expect(read(templated('DaemonSet', { template }))).toEqual(expected)
    })

    it('reads the pod template of a ReplicaSet', () => {
        expect(read(templated('ReplicaSet', { replicas: 3, template }))).toEqual(expected)
    })

    it('reads the pod template of a Job', () => {
        expect(read({ apiVersion: 'batch/v1', kind: 'Job', spec: { completions: 1, template } })).toEqual(expected)
    })

    it('reads a CronJob through both of its templates', () => {
        const cronJob = {
            apiVersion: 'batch/v1',
            kind: 'CronJob',
            spec: { schedule: '0 * * * *', jobTemplate: { spec: { template } } },
        }

        expect(read(cronJob)).toEqual(expected)
    })

    it('still names the objects a workload template depends on', () => {
        const plans = PodEnvironmentPlan.of(templated('Deployment', { template }))

        expect(PodEnvironmentPlan.referencesOf(plans)).toEqual([
            { sourceKind: 'configMap', name: 'feature-flags' },
            { sourceKind: 'configMap', name: 'app-config' },
        ])
    })
})

describe('PodEnvironmentPlan.referencesOf', () => {
    it('names each referenced object once however many variables reach it', () => {
        const references = PodEnvironmentPlan.referencesOf(PodEnvironmentPlan.of(pod))

        expect(references).toEqual([
            { sourceKind: 'secret', name: 'db-creds' },
            { sourceKind: 'configMap', name: 'feature-flags' },
            { sourceKind: 'configMap', name: 'app-config' },
        ])
    })

    it('tells a ConfigMap and a Secret of the same name apart', () => {
        const plans = PodEnvironmentPlan.of({
            spec: {
                containers: [{
                    name: 'api',
                    env: [
                        { name: 'A', valueFrom: { configMapKeyRef: { name: 'shared', key: 'a' } } },
                        { name: 'B', valueFrom: { secretKeyRef: { name: 'shared', key: 'b' } } },
                    ],
                }],
            },
        })

        expect(PodEnvironmentPlan.referencesOf(plans)).toHaveLength(2)
    })

    it('finds nothing to read for a pod built from literals alone', () => {
        const plans = PodEnvironmentPlan.of({ spec: { containers: [{ name: 'api', env: [{ name: 'A', value: '1' }] }] } })

        expect(PodEnvironmentPlan.referencesOf(plans)).toEqual([])
    })
})

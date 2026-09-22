import { describe, expect, it } from 'vitest'
import { PodEnvironmentReport } from '@/application/services/podEnvironment/models/PodEnvironmentReport'
import { PodEnvironmentSources } from '@/application/services/podEnvironment/models/PodEnvironmentSources'
import { PodEnvironmentPlan } from '@/domain/entities/workloads'
import type { TPodEnvironmentSource } from '@/application/services/podEnvironment/types/TPodEnvironmentSource'

const pod = {
    spec: {
        initContainers: [{ name: 'migrate', env: [{ name: 'MODE', value: 'up' }] }],
        containers: [{
            name: 'api',
            env: [
                { name: 'APP_URL', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'url' } } },
                { name: 'ABSENT', valueFrom: { configMapKeyRef: { name: 'app-config', key: 'nowhere' } } },
                { name: 'DB_PASSWORD', valueFrom: { secretKeyRef: { name: 'db-creds', key: 'password' } } },
                { name: 'NODE_NAME', valueFrom: { fieldRef: { fieldPath: 'spec.nodeName' } } },
                { name: 'CPU_LIMIT', valueFrom: { resourceFieldRef: { resource: 'limits.cpu', containerName: 'sidecar' } } },
            ],
            envFrom: [{ prefix: 'FEATURE_', configMapRef: { name: 'feature-flags' } }],
        }],
    },
}

const sourcesWith = (overrides: Record<string, TPodEnvironmentSource> = {}): PodEnvironmentSources => {
    const sources = new PodEnvironmentSources()
    sources.remember(
        { sourceKind: 'configMap', name: 'app-config' },
        overrides['app-config'] ?? { state: 'read', data: { url: 'https://api.internal' }, encoded: false },
    )
    sources.remember(
        { sourceKind: 'configMap', name: 'feature-flags' },
        overrides['feature-flags'] ?? { state: 'read', data: { new_ui: 'true', beta: 'false' }, encoded: false },
    )
    sources.remember(
        { sourceKind: 'secret', name: 'db-creds' },
        overrides['db-creds'] ?? { state: 'read', data: { password: btoa('placeholder-value') }, encoded: true },
    )

    return sources
}

const report = (overrides: Record<string, TPodEnvironmentSource> = {}) =>
    PodEnvironmentReport.of(PodEnvironmentPlan.of(pod), sourcesWith(overrides))

const entryFor = (variable: string, overrides: Record<string, TPodEnvironmentSource> = {}) =>
    report(overrides)[1].entries.find(entry => entry.variable === variable)

describe('PodEnvironmentReport', () => {
    it('keeps one group per container and says which is an init container', () => {
        expect(report().map(group => [group.container, group.isInit])).toEqual([
            ['migrate', true],
            ['api', false],
        ])
    })

    it('puts the envFrom block before the variables env declares', () => {
        expect(report()[1].entries.map(entry => entry.variable)).toEqual([
            'FEATURE_beta',
            'FEATURE_new_ui',
            'APP_URL',
            'ABSENT',
            'DB_PASSWORD',
            'NODE_NAME',
            'CPU_LIMIT',
        ])
    })

    it('gives every entry of a container an id of its own', () => {
        const ids = report()[1].entries.map(entry => entry.id)

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('resolves a ConfigMap key and names the reference beside the value', () => {
        expect(entryFor('APP_URL')).toMatchObject({
            value: 'https://api.internal',
            provenance: 'configmap/app-config · key: url',
            masked: false,
            state: 'resolved',
        })
    })

    it('decodes a Secret key and marks it as one to hide', () => {
        expect(entryFor('DB_PASSWORD')).toMatchObject({
            value: 'placeholder-value',
            provenance: 'secret/db-creds · key: password',
            masked: true,
            state: 'resolved',
        })
    })

    it('expands an envFrom map into one entry per key, prefixed', () => {
        expect(entryFor('FEATURE_new_ui')).toMatchObject({
            value: 'true',
            provenance: 'configmap/feature-flags · key: new_ui',
            state: 'resolved',
        })
    })

    it('never masks a literal', () => {
        expect(report()[0].entries[0]).toMatchObject({ variable: 'MODE', value: 'up', masked: false, state: 'literal' })
    })

    it('shows a downward-API path instead of a value the object does not carry', () => {
        expect(entryFor('NODE_NAME')).toMatchObject({
            value: 'spec.nodeName',
            provenance: 'fieldRef',
            state: 'path',
        })
    })

    it('names the container a resourceFieldRef measures', () => {
        expect(entryFor('CPU_LIMIT')).toMatchObject({
            value: 'limits.cpu',
            provenance: 'resourceFieldRef · sidecar',
            state: 'path',
        })
    })

    it('calls a key that is not in the map unresolved and still names the reference', () => {
        expect(entryFor('ABSENT')).toMatchObject({
            value: '',
            provenance: 'configmap/app-config · key: nowhere',
            state: 'unresolved',
        })
    })

    it('calls a reference to an object that is gone unresolved', () => {
        const absent: TPodEnvironmentSource = { state: 'missing', data: {}, encoded: false }

        expect(entryFor('DB_PASSWORD', { 'db-creds': absent })).toMatchObject({ state: 'unresolved', masked: false })
    })

    it('says plainly when a reference may not be read', () => {
        const refused: TPodEnvironmentSource = { state: 'forbidden', data: {}, encoded: false }

        expect(entryFor('DB_PASSWORD', { 'db-creds': refused })).toMatchObject({
            state: 'forbidden',
            value: '',
            provenance: 'secret/db-creds · key: password',
        })
    })

    it('stands an envFrom map nobody may read in for its own entries', () => {
        const refused: TPodEnvironmentSource = { state: 'forbidden', data: {}, encoded: false }

        expect(report({ 'feature-flags': refused })[1].entries[0]).toMatchObject({
            variable: '',
            provenance: 'configmap/feature-flags',
            state: 'forbidden',
        })
    })

    it('stands an envFrom map that is gone in for its own entries', () => {
        const absent: TPodEnvironmentSource = { state: 'missing', data: {}, encoded: false }

        expect(report({ 'feature-flags': absent })[1].entries[0]).toMatchObject({
            variable: '',
            provenance: 'configmap/feature-flags',
            state: 'unresolved',
        })
    })
})

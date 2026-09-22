import { describe, expect, it } from 'vitest'
import { PodEnvironmentSources } from '@/application/services/podEnvironment/models/PodEnvironmentSources'
import type { TPodEnvironmentObjectRef } from '@/domain/entities/workloads'

const configMap: TPodEnvironmentObjectRef = { sourceKind: 'configMap', name: 'app-config' }

const secret: TPodEnvironmentObjectRef = { sourceKind: 'secret', name: 'db-creds' }

const filled = (): PodEnvironmentSources => {
    const sources = new PodEnvironmentSources()
    sources.remember(configMap, { state: 'read', data: { url: 'https://api.internal', tier: 'gold' }, encoded: false })
    sources.remember(secret, { state: 'read', data: { password: btoa('placeholder-value') }, encoded: true })

    return sources
}

describe('PodEnvironmentSources', () => {
    it('treats an object nobody read as missing rather than empty-but-present', () => {
        expect(new PodEnvironmentSources().of(configMap)).toEqual({ state: 'missing', data: {}, encoded: false })
    })

    it('reads a ConfigMap value as it is stored', () => {
        expect(filled().valueOf(configMap, 'url')).toBe('https://api.internal')
    })

    it('decodes a Secret value out of base64', () => {
        expect(filled().valueOf(secret, 'password')).toBe('placeholder-value')
    })

    it('lists the keys of a map in a stable order', () => {
        expect(filled().keysOf(configMap)).toEqual(['tier', 'url'])
    })

    it('says whether a key is in the map at all', () => {
        expect(filled().has(configMap, 'url')).toBe(true)
        expect(filled().has(configMap, 'absent')).toBe(false)
    })

    it('tells a ConfigMap from a Secret of the same name', () => {
        const sources = new PodEnvironmentSources()
        sources.remember({ sourceKind: 'configMap', name: 'shared' }, { state: 'read', data: { a: '1' }, encoded: false })
        sources.remember({ sourceKind: 'secret', name: 'shared' }, { state: 'forbidden', data: {}, encoded: false })

        expect(sources.size).toBe(2)
        expect(sources.of({ sourceKind: 'secret', name: 'shared' }).state).toBe('forbidden')
    })
})

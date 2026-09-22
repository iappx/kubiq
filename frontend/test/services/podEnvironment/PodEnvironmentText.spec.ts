import { describe, expect, it } from 'vitest'
import { PodEnvironmentText } from '@/application/services/podEnvironment/models/PodEnvironmentText'
import type { TPodEnvironmentEntry } from '@/application/services/podEnvironment/types/TPodEnvironmentEntry'
import type { TPodEnvironmentGroup } from '@/application/services/podEnvironment/types/TPodEnvironmentGroup'

const entry = (overrides: Partial<TPodEnvironmentEntry>): TPodEnvironmentEntry => ({
    id: 'api/0/A',
    variable: 'A',
    value: '1',
    provenance: '',
    masked: false,
    state: 'literal',
    ...overrides,
})

const group = (entries: TPodEnvironmentEntry[]): TPodEnvironmentGroup => ({
    container: 'api',
    isInit: false,
    entries,
})

describe('PodEnvironmentText', () => {
    it('writes one variable as an assignment', () => {
        expect(PodEnvironmentText.lineOf(entry({ variable: 'LOG_LEVEL', value: 'debug' }))).toBe('LOG_LEVEL=debug')
    })

    it('joins a block with one variable per line', () => {
        const entries = [entry({ variable: 'A', value: '1' }), entry({ variable: 'B', value: '2' })]

        expect(PodEnvironmentText.of(entries)).toBe('A=1\nB=2')
    })

    it('copies a value read out of a Secret like any other', () => {
        const copied = PodEnvironmentText.copyable(group([entry({ state: 'resolved', masked: true })]))

        expect(copied).toHaveLength(1)
    })

    it('leaves out a downward-API path, which is not a value', () => {
        const copied = PodEnvironmentText.copyable(group([entry({ variable: 'NODE', value: 'spec.nodeName', state: 'path' })]))

        expect(copied).toEqual([])
    })

    it('leaves out a reference that could not be read', () => {
        const copied = PodEnvironmentText.copyable(group([
            entry({ variable: 'A', state: 'unresolved', value: '' }),
            entry({ variable: 'B', state: 'forbidden', value: '' }),
            entry({ variable: '', state: 'forbidden', value: '' }),
        ]))

        expect(copied).toEqual([])
    })

    it('says whether a container carries anything that came from a Secret', () => {
        expect(PodEnvironmentText.hidesSecret(group([entry({ masked: true, state: 'resolved' })]))).toBe(true)
        expect(PodEnvironmentText.hidesSecret(group([entry({})]))).toBe(false)
    })
})

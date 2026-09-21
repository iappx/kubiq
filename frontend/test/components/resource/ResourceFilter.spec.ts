import { describe, expect, it } from 'vitest'
import { ResourceFilter } from '@/components/resource/ResourceFilter'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'

const row = (name: string, namespace = 'default'): TResourceRow => ({
    key: `${namespace}/${name}`,
    name,
    namespace,
    createdAt: '',
    tone: 'ok',
    statusTitle: 'Healthy',
})

describe('ResourceFilter.isLabelSelector', () => {
    it('reads an equality requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('app=api')).toBe(true)
    })

    it('reads a double-equals requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('app==api')).toBe(true)
    })

    it('reads an inequality requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('tier!=cache')).toBe(true)
    })

    it('reads a set requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('env in (prod, staging)')).toBe(true)
    })

    it('reads a notin requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('env notin (dev)')).toBe(true)
    })

    it('reads a negated existence requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('!canary')).toBe(true)
    })

    it('accepts a prefixed key, which is how most operators label', () => {
        expect(ResourceFilter.isLabelSelector('app.kubernetes.io/name=api')).toBe(true)
    })

    it('accepts several requirements at once', () => {
        expect(ResourceFilter.isLabelSelector('app=api,tier!=cache')).toBe(true)
    })

    // A bare word is a valid "label exists" requirement in Kubernetes, so this departs from
    // the selector grammar on purpose: reading nginx that way would empty the table.
    it('reads a bare word as text, not as an existence requirement', () => {
        expect(ResourceFilter.isLabelSelector('nginx')).toBe(false)
    })

    it('reads a bare word beside a real requirement as a selector', () => {
        expect(ResourceFilter.isLabelSelector('app=api,canary')).toBe(true)
    })

    it('reads a sentence as text', () => {
        expect(ResourceFilter.isLabelSelector('api gateway')).toBe(false)
    })

    it('reads a name fragment with a dash as text', () => {
        expect(ResourceFilter.isLabelSelector('api-gateway-7d9')).toBe(false)
    })

    it('reads an empty query as neither', () => {
        expect(ResourceFilter.isLabelSelector('')).toBe(false)
    })

    it('reads a half-typed requirement as text rather than sending it', () => {
        expect(ResourceFilter.isLabelSelector('app=api,')).toBe(false)
    })
})

describe('ResourceFilter.parse', () => {
    it('sends a selector to the cluster and leaves the text filter empty', () => {
        expect(ResourceFilter.parse('  app=api  ')).toEqual({ text: '', labelSelector: 'app=api' })
    })

    it('keeps text out of the request', () => {
        expect(ResourceFilter.parse('  nginx ')).toEqual({ text: 'nginx', labelSelector: '' })
    })

    it('normalises the spacing around the commas it sends', () => {
        expect(ResourceFilter.parse('app=api,  tier!=cache').labelSelector).toBe('app=api,tier!=cache')
    })

    it('leaves the values inside a set alone', () => {
        expect(ResourceFilter.parse('env in (prod, staging)').labelSelector).toBe('env in (prod, staging)')
    })
})

describe('ResourceFilter.apply', () => {
    const rows = [row('api-gateway'), row('worker'), row('API-CACHE')]

    it('matches a fragment of the name', () => {
        expect(ResourceFilter.apply(rows, 'gate').map(match => match.name)).toEqual(['api-gateway'])
    })

    it('ignores case', () => {
        expect(ResourceFilter.apply(rows, 'api').map(match => match.name)).toEqual(['api-gateway', 'API-CACHE'])
    })

    it('keeps every row when nothing is typed', () => {
        expect(ResourceFilter.apply(rows, '')).toHaveLength(3)
    })

    it('answers with nothing rather than everything when nothing matches', () => {
        expect(ResourceFilter.apply(rows, 'zzz')).toEqual([])
    })
})

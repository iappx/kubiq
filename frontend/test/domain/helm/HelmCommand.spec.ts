import { describe, expect, it } from 'vitest'
import { HelmCommand } from '@/domain/models/helm/HelmCommand'

describe('HelmCommand', () => {
    it('asks helm for machine-readable output where helm offers it', () => {
        expect(HelmCommand.list()).toEqual(['list', '--output', 'json'])
        expect(HelmCommand.repositories()).toEqual(['repo', 'list', '--output', 'json'])
        expect(HelmCommand.history('api', 20)).toEqual(['history', 'api', '--max', '20', '--output', 'json'])
    })

    it('reads values as yaml, because that is what the editor shows and sends back', () => {
        expect(HelmCommand.values('api', false)).toEqual(['get', 'values', 'api', '--output', 'yaml'])
        expect(HelmCommand.values('api', true)).toEqual(['get', 'values', 'api', '--output', 'yaml', '--all'])
    })

    it('leaves the version out when none was chosen', () => {
        expect(HelmCommand.install('web', 'bitnami/nginx', '', false))
            .toEqual(['install', 'web', 'bitnami/nginx'])
        expect(HelmCommand.install('web', 'bitnami/nginx', '15.1.0', true))
            .toEqual(['install', 'web', 'bitnami/nginx', '--version', '15.1.0', '--create-namespace'])
    })

    it('resets the stored values by default and merges them only when asked', () => {
        expect(HelmCommand.upgrade('web', 'bitnami/nginx', '', false)).toContain('--reset-values')
        expect(HelmCommand.upgrade('web', 'bitnami/nginx', '', true)).toContain('--reuse-values')
    })

    it('names the context and the namespace only when there is one', () => {
        expect(HelmCommand.context('staging')).toEqual(['--kube-context', 'staging'])
        expect(HelmCommand.context('')).toEqual([])
        expect(HelmCommand.namespace('dev')).toEqual(['--namespace', 'dev'])
        expect(HelmCommand.namespace('')).toEqual([])
    })

    it('escapes a release name before it becomes a --filter regular expression', () => {
        expect(HelmCommand.literal('web.api+1')).toBe('web\\.api\\+1')
        expect(HelmCommand.literal('plain')).toBe('plain')
    })

    it('searches every version only when asked', () => {
        expect(HelmCommand.search('nginx', false)).toEqual(['search', 'repo', '--output', 'json', 'nginx'])
        expect(HelmCommand.search('nginx', true)).toEqual(['search', 'repo', '--output', 'json', 'nginx', '--versions'])
        expect(HelmCommand.search('', false)).toEqual(['search', 'repo', '--output', 'json'])
    })
})

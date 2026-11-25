import { describe, expect, it } from 'vitest'
import { KubeJsonPath } from '@/domain/models/kube'
import { KubeObjectFixtures } from '../../support/fixtures/KubeObjectFixtures'

describe('KubeJsonPath', () => {
    it('reads the paths a CRD printer column declares', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.spec.secretName')).toBe('web-tls')
        expect(KubeJsonPath.read(object, '.metadata.creationTimestamp')).toBe('2026-08-25T12:00:00Z')
        expect(KubeJsonPath.read(object, '.spec.issuerRef.name')).toBe('letsencrypt')
    })

    it('walks array indices', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.status.conditions[0].status')).toBe('True')
        expect(KubeJsonPath.read(object, '.spec.dnsNames[0]')).toBe('example.test')
    })

    it('returns undefined instead of throwing on a path that is not there', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.status.missing.deeper')).toBeUndefined()
        expect(KubeJsonPath.read(object, '.status.conditions[9].status')).toBeUndefined()
        expect(KubeJsonPath.read(undefined, '.spec.secretName')).toBeUndefined()
    })

    it('parses the leading dollar and dot that the notation allows', () => {
        expect(KubeJsonPath.parse('$.spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('.spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('spec.replicas')).toEqual(['spec', 'replicas'])
        expect(KubeJsonPath.parse('.status.conditions[0].status')).toEqual(['status', 'conditions', '0', 'status'])
        expect(KubeJsonPath.parse('.')).toEqual([])
    })

    it('evaluates array filter expressions with double and single quotes', () => {
        const certificate = {
            status: {
                conditions: [
                    { type: 'Issuing', status: 'False', message: 'Not issuing' },
                    { type: 'Ready', status: 'True', message: 'Certificate is up to date' },
                ],
            },
        }

        expect(KubeJsonPath.read(certificate, '.status.conditions[?(@.type=="Ready")].status')).toBe('True')
        expect(KubeJsonPath.read(certificate, ".status.conditions[?(@.type=='Ready')].message")).toBe('Certificate is up to date')
        expect(KubeJsonPath.read(certificate, '.status.conditions[?(@.type=="Synced")].status')).toBeUndefined()
    })

    it('evaluates inequality, nested paths, typed literals, existence checks and compound filters', () => {
        const source = {
            items: [
                { metadata: { name: 'primary' }, ready: true, port: 80, error: null },
                { metadata: { name: 'secondary' }, ready: false, port: 443, error: 'timeout' },
                { metadata: { name: 'canary' }, ready: true, port: 8080, error: null },
            ],
        }

        expect(KubeJsonPath.read(source, '.items[?(@.metadata.name=="primary")].port')).toBe(80)
        expect(KubeJsonPath.read(source, '.items[?(@.ready==false)].metadata.name')).toBe('secondary')
        expect(KubeJsonPath.read(source, '.items[?(@.port==443)].error')).toBe('timeout')
        expect(KubeJsonPath.read(source, '.items[?(@.error!=null)].metadata.name')).toBe('secondary')
        expect(KubeJsonPath.read(source, '.items[?(@.ready)].metadata.name')).toEqual(['primary', 'canary'])
        expect(KubeJsonPath.read(source, '.items[?(!@.ready)].metadata.name')).toBe('secondary')
        expect(KubeJsonPath.read(source, '.items[?(@.ready==true && @.port>100)].metadata.name')).toBe('canary')
        expect(KubeJsonPath.read(source, '.items[?(@.port==80 || @.port==443)].metadata.name')).toEqual(['primary', 'secondary'])
    })

    it('evaluates filter expressions with spaces, missing parens or brackets inside quoted values', () => {
        const source = {
            conditions: [
                { type: 'Ready', note: 'ok [v1]', status: 'True' },
            ],
        }

        expect(KubeJsonPath.read(source, '.conditions[?( @.type == "Ready" )].status')).toBe('True')
        expect(KubeJsonPath.read(source, '.conditions[?@.note=="ok [v1]"].status')).toBe('True')
    })

    it('evaluates wildcard array and map accesses', () => {
        const multi = {
            metadata: { labels: { app: 'web', tier: 'frontend' } },
            spec: { dnsNames: ['a.example.test', 'b.example.test'] },
        }
        const single = { spec: { dnsNames: ['only.example.test'] } }
        const empty = { spec: { dnsNames: [] } }

        expect(KubeJsonPath.read(multi, '.spec.dnsNames[*]')).toEqual(['a.example.test', 'b.example.test'])
        expect(KubeJsonPath.read(single, '.spec.dnsNames[*]')).toBe('only.example.test')
        expect(KubeJsonPath.read(empty, '.spec.dnsNames[*]')).toBeUndefined()
        expect(KubeJsonPath.read(multi, '.metadata.labels[*]')).toEqual(['web', 'frontend'])
    })

    it('reads bracket-quoted keys and backslash-escaped dotted keys', () => {
        const source = {
            metadata: {
                annotations: {
                    'cert-manager.io/issuer-name': 'letsencrypt-prod',
                    "quote'key": 'escaped',
                },
                labels: {
                    'app.kubernetes.io/name': 'ingress',
                },
            },
        }

        expect(KubeJsonPath.read(source, ".metadata.annotations['cert-manager.io/issuer-name']")).toBe('letsencrypt-prod')
        expect(KubeJsonPath.read(source, '.metadata.annotations["cert-manager.io/issuer-name"]')).toBe('letsencrypt-prod')
        expect(KubeJsonPath.read(source, ".metadata.annotations['quote\\'key']")).toBe('escaped')
        expect(KubeJsonPath.read(source, '.metadata.labels.app\\.kubernetes\\.io/name')).toBe('ingress')
    })

    it('returns undefined for malformed jsonPath expressions instead of throwing', () => {
        const object = KubeObjectFixtures.customResource()

        expect(KubeJsonPath.read(object, '.status.conditions[?(@.type=="Ready"')).toBeUndefined()
        expect(KubeJsonPath.read(object, '.status.conditions[]')).toBeUndefined()
        expect(KubeJsonPath.read(object, '.status.conditions[?()]')).toBeUndefined()
        expect(KubeJsonPath.read(object, '.status.conditions[invalid]')).toBeUndefined()
    })
})

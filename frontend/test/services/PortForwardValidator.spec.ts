import { describe, expect, it } from 'vitest'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'
import type { TPortForwardDraft } from '@/application/services/portForward/types/TPortForwardDraft'

const validator = new PortForwardValidator()

const draft = (changes: Partial<TPortForwardDraft> = {}): TPortForwardDraft => ({
    resource: 'pods',
    namespace: 'payments',
    name: 'api-0',
    remotePort: '8080',
    localPort: '',
    ...changes,
})

describe('PortForwardValidator', () => {
    it('accepts a remote port with no local port', () => {
        const result = validator.validate(draft())

        expect(result.valid).toBe(true)
        expect(PortForwardValidator.parse(draft())).toEqual({
            remotePort: 8080,
            localPort: 0,
        })
    })

    it('accepts a chosen local port', () => {
        expect(validator.validate(draft({ localPort: '18080' })).valid).toBe(true)
        expect(PortForwardValidator.parse(draft({ localPort: '18080' })).localPort).toBe(18080)
    })

    it('asks for the port to forward', () => {
        expect(validator.validate(draft({ remotePort: '  ' })).errors.remotePort).toBeTruthy()
    })

    it('refuses anything that is not a port number', () => {
        expect(validator.validate(draft({ remotePort: 'http' })).errors.remotePort).toBeTruthy()
        expect(validator.validate(draft({ remotePort: '0' })).errors.remotePort).toBeTruthy()
        expect(validator.validate(draft({ remotePort: '70000' })).errors.remotePort).toBeTruthy()
        expect(validator.validate(draft({ localPort: '70000' })).errors.localPort).toBeTruthy()
        expect(validator.validate(draft({ localPort: '-1' })).errors.localPort).toBeTruthy()
    })

    it('asks for the target before it asks for anything else', () => {
        const result = validator.validate(draft({ namespace: '  ', name: '' }))

        expect(result.errors.namespace).toBeTruthy()
        expect(result.errors.name).toBeTruthy()
    })

    it('refuses a target that Kubernetes could never have named', () => {
        expect(validator.validate(draft({ namespace: 'Payments' })).errors.namespace).toBeTruthy()
        expect(validator.validate(draft({ namespace: 'payments/../kube-system' })).errors.namespace).toBeTruthy()
        expect(validator.validate(draft({ name: 'api 0' })).errors.name).toBeTruthy()
        expect(validator.validate(draft({ name: '../secrets' })).errors.name).toBeTruthy()
    })

    it('accepts a name carrying the dots a subdomain is allowed', () => {
        expect(validator.validate(draft({ name: 'api.payments.svc' })).valid).toBe(true)
    })

    it('collects every problem in one pass', () => {
        const result = validator.validate(draft({ namespace: '', name: '', remotePort: '', localPort: 'x' }))

        expect(Object.keys(result.errors).sort()).toEqual(['localPort', 'name', 'namespace', 'remotePort'])
    })
})

import { describe, expect, it } from 'vitest'
import { PortForwardValidator } from '@/application/validators/PortForwardValidator'

const validator = new PortForwardValidator()

describe('PortForwardValidator', () => {
    it('accepts a remote port with no local port', () => {
        const result = validator.validate({ remotePort: '8080', localPort: '' })

        expect(result.valid).toBe(true)
        expect(PortForwardValidator.parse({ remotePort: '8080', localPort: '' })).toEqual({
            remotePort: 8080,
            localPort: 0,
        })
    })

    it('accepts a chosen local port', () => {
        expect(validator.validate({ remotePort: '8080', localPort: '18080' }).valid).toBe(true)
        expect(PortForwardValidator.parse({ remotePort: '8080', localPort: '18080' }).localPort).toBe(18080)
    })

    it('asks for the port to forward', () => {
        expect(validator.validate({ remotePort: '  ', localPort: '' }).errors.remotePort).toBeTruthy()
    })

    it('refuses anything that is not a port number', () => {
        expect(validator.validate({ remotePort: 'http', localPort: '' }).errors.remotePort).toBeTruthy()
        expect(validator.validate({ remotePort: '0', localPort: '' }).errors.remotePort).toBeTruthy()
        expect(validator.validate({ remotePort: '70000', localPort: '' }).errors.remotePort).toBeTruthy()
        expect(validator.validate({ remotePort: '8080', localPort: '70000' }).errors.localPort).toBeTruthy()
        expect(validator.validate({ remotePort: '8080', localPort: '-1' }).errors.localPort).toBeTruthy()
    })

    it('collects every problem in one pass', () => {
        const result = validator.validate({ remotePort: '', localPort: 'x' })

        expect(Object.keys(result.errors).sort()).toEqual(['localPort', 'remotePort'])
    })
})

import { describe, expect, it } from 'vitest'
import { PortForwardPortOptions } from '@/components/terminal/PortForwardPortOptions'

const http = { port: 8080, name: 'http', protocol: 'TCP' }
const metrics = { port: 9100, name: '', protocol: 'TCP' }
const dns = { port: 53, name: 'dns', protocol: 'UDP' }

describe('PortForwardPortOptions', () => {
    it('shows the number, the name and the protocol of every declared port', () => {
        expect(PortForwardPortOptions.of([http, metrics])).toEqual([
            { value: '8080', title: '8080', detail: 'http · TCP', disabled: false },
            { value: '9100', title: '9100', detail: 'TCP', disabled: false },
        ])
    })

    it('lists a port that cannot be forwarded, but does not let it be picked', () => {
        const [option] = PortForwardPortOptions.of([dns])

        expect(option.disabled).toBe(true)
        expect(option.detail).toContain('UDP')
        expect(option.detail).toContain('cannot be forwarded')
    })

    it('picks the only declared port', () => {
        expect(PortForwardPortOptions.initial([http], '')).toBe('8080')
    })

    it('leaves the choice open when there is more than one port, or none', () => {
        expect(PortForwardPortOptions.initial([http, metrics], '')).toBe('')
        expect(PortForwardPortOptions.initial([], '')).toBe('')
    })

    it('does not pick the only port when it cannot be forwarded', () => {
        expect(PortForwardPortOptions.initial([dns], '')).toBe('')
    })

    it('keeps the port it was asked to preselect, by number or by name', () => {
        expect(PortForwardPortOptions.initial([http, metrics], 9100)).toBe('9100')
        expect(PortForwardPortOptions.initial([http, metrics], 'http')).toBe('http')
        expect(PortForwardPortOptions.initial([http], 0)).toBe('8080')
    })

    it('treats the protocol without regard to case', () => {
        expect(PortForwardPortOptions.isForwardable({ ...http, protocol: 'tcp' })).toBe(true)
    })

    it('formats labels and details including the container name when present', () => {
        const health = { port: 9879, name: 'health', protocol: 'TCP', container: 'cilium-agent' }

        expect(PortForwardPortOptions.labelOf(health)).toBe('health · 9879')
        expect(PortForwardPortOptions.labelOf(metrics)).toBe('9100')
        expect(PortForwardPortOptions.of([health])[0].detail).toBe('health · cilium-agent · TCP')
    })

    it('matches a declared forwardable port by number or by name', () => {
        expect(PortForwardPortOptions.matchingValue([http, metrics, dns], '8080')).toBe('8080')
        expect(PortForwardPortOptions.matchingValue([http, metrics, dns], 'http')).toBe('8080')
        expect(PortForwardPortOptions.matchingValue([http, metrics, dns], '53')).toBe('')
        expect(PortForwardPortOptions.matchingValue([http, metrics, dns], '9999')).toBe('')
    })

    it('suggests the same local port only for unprivileged numeric ports', () => {
        expect(PortForwardPortOptions.suggestedLocalPort('9879')).toBe('9879')
        expect(PortForwardPortOptions.suggestedLocalPort('1024')).toBe('1024')
        expect(PortForwardPortOptions.suggestedLocalPort('80')).toBe('')
        expect(PortForwardPortOptions.suggestedLocalPort('1023')).toBe('')
        expect(PortForwardPortOptions.suggestedLocalPort('http')).toBe('')
        expect(PortForwardPortOptions.suggestedLocalPort('70000')).toBe('')
    })

    it('parses valid local port numbers and rejects anything else', () => {
        expect(PortForwardPortOptions.parseLocalPort(' 8080 ')).toBe(8080)
        expect(PortForwardPortOptions.parseLocalPort('1')).toBe(1)
        expect(PortForwardPortOptions.parseLocalPort('65535')).toBe(65535)
        expect(PortForwardPortOptions.parseLocalPort('0')).toBeNull()
        expect(PortForwardPortOptions.parseLocalPort('65536')).toBeNull()
        expect(PortForwardPortOptions.parseLocalPort('abc')).toBeNull()
        expect(PortForwardPortOptions.parseLocalPort('')).toBeNull()
    })
})

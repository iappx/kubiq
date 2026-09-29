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
})

import { describe, expect, it } from 'vitest'
import { OpenPortForwardEvent } from '@/domain/events/terminal/OpenPortForwardEvent'

describe('OpenPortForwardEvent', () => {
    it('asks for a new forward with nothing chosen yet', () => {
        const event = new OpenPortForwardEvent('prod', 'payments')

        expect(event.isEdit).toBe(false)
        expect(event.hasTarget).toBe(false)
        expect(event.remotePort).toBe('')
    })

    it('asks for a new forward from a known object, with a port preselected', () => {
        const event = new OpenPortForwardEvent('prod', 'payments', 'services', 'api', 8080)

        expect(event.isEdit).toBe(false)
        expect(event.hasTarget).toBe(true)
        expect(event.remotePort).toBe(8080)
    })

    it('asks to edit a saved forward by its id', () => {
        const event = OpenPortForwardEvent.edit('prod', 'pf-1')

        expect(event.isEdit).toBe(true)
        expect(event.clusterId).toBe('prod')
        expect(event.forwardId).toBe('pf-1')
    })
})

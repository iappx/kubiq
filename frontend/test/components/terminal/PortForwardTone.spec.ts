import { describe, expect, it } from 'vitest'
import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import { PortForwardTone } from '@/components/terminal/PortForwardTone'
import type { TPortForwardStatus } from '@/domain/entities/portForward'

const withStatus = (status: TPortForwardStatus): TPortForward => ({
    id: status,
    clusterId: 'prod',
    namespace: 'payments',
    resource: 'pods',
    name: 'api-0',
    remotePort: 8080,
    localPort: 0,
    lastLocalPort: 0,
    restoreMode: 'onConnect',
    isStoppedByUser: false,
    createdAt: 1,
    label: 'pod/api-0:8080',
    ...PortForwardRecord.idle(status),
})

describe('PortForwardTone', () => {
    it('gives every status a tone of its own shape', () => {
        expect(PortForwardTone.of('active')).toBe('ok')
        expect(PortForwardTone.of('starting')).toBe('pending')
        expect(PortForwardTone.of('waiting')).toBe('pending')
        expect(PortForwardTone.of('stopped')).toBe('unknown')
        expect(PortForwardTone.of('reconnecting')).toBe('warning')
        expect(PortForwardTone.of('error')).toBe('error')
    })

    it('lets the worst forward set the tone of the chip', () => {
        expect(PortForwardTone.summary([withStatus('active'), withStatus('reconnecting'), withStatus('error')])).toBe('error')
        expect(PortForwardTone.summary([withStatus('active'), withStatus('reconnecting')])).toBe('warning')
        expect(PortForwardTone.summary([withStatus('active'), withStatus('stopped')])).toBe('ok')
        expect(PortForwardTone.summary([withStatus('stopped'), withStatus('waiting')])).toBe('unknown')
    })

    it('raises the alarm only for problems', () => {
        expect(PortForwardTone.isAlarming('error')).toBe(true)
        expect(PortForwardTone.isAlarming('warning')).toBe(true)
        expect(PortForwardTone.isAlarming('ok')).toBe(false)
        expect(PortForwardTone.isAlarming('unknown')).toBe(false)
    })
})

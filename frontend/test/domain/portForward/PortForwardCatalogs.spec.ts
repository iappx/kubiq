import { describe, expect, it } from 'vitest'
import {
    PortForwardRemotePort,
    PortForwardRestoreModeCatalog,
    PortForwardStatusCatalog,
} from '@/domain/entities/portForward'

describe('PortForwardRestoreModeCatalog', () => {
    it('restores on connect by default', () => {
        expect(PortForwardRestoreModeCatalog.defaultMode).toBe('onConnect')
        expect(PortForwardRestoreModeCatalog.of(undefined)).toBe('onConnect')
        expect(PortForwardRestoreModeCatalog.of('sometimes')).toBe('onConnect')
    })

    it('offers the three modes with a title and a caption each', () => {
        expect(PortForwardRestoreModeCatalog.modes).toEqual(['manual', 'onConnect', 'connectOnStart'])
        PortForwardRestoreModeCatalog.modes.forEach((mode) => {
            expect(PortForwardRestoreModeCatalog.title(mode)).not.toBe('')
            expect(PortForwardRestoreModeCatalog.description(mode)).not.toBe('')
        })
    })

    it('says which modes come back with the cluster and which connect it on start', () => {
        expect(PortForwardRestoreModeCatalog.restoresOnConnect('manual')).toBe(false)
        expect(PortForwardRestoreModeCatalog.restoresOnConnect('onConnect')).toBe(true)
        expect(PortForwardRestoreModeCatalog.restoresOnConnect('connectOnStart')).toBe(true)
        expect(PortForwardRestoreModeCatalog.connectsOnStart('onConnect')).toBe(false)
        expect(PortForwardRestoreModeCatalog.connectsOnStart('connectOnStart')).toBe(true)
    })
})

describe('PortForwardStatusCatalog', () => {
    it('titles every status', () => {
        expect(PortForwardStatusCatalog.title('waiting')).toBe('Waiting for cluster')
        expect(PortForwardStatusCatalog.has('reconnecting')).toBe(true)
        expect(PortForwardStatusCatalog.has('failed')).toBe(false)
    })

    it('counts a forward looking for a new pod as still listening, and as trouble', () => {
        expect(PortForwardStatusCatalog.isListening('reconnecting')).toBe(true)
        expect(PortForwardStatusCatalog.isProblematic('reconnecting')).toBe(true)
        expect(PortForwardStatusCatalog.isListening('starting')).toBe(false)
        expect(PortForwardStatusCatalog.isRunning('starting')).toBe(true)
        expect(PortForwardStatusCatalog.isRunning('waiting')).toBe(false)
        expect(PortForwardStatusCatalog.isProblematic('stopped')).toBe(false)
    })
})

describe('PortForwardRemotePort', () => {
    it('reads digits as a number and anything else as a port name', () => {
        expect(PortForwardRemotePort.of(' 8080 ')).toBe(8080)
        expect(PortForwardRemotePort.of('http')).toBe('http')
        expect(PortForwardRemotePort.of(443)).toBe(443)
        expect(PortForwardRemotePort.isNamed('http')).toBe(true)
    })

    it('treats the same port written two ways as one', () => {
        expect(PortForwardRemotePort.same(8080, '8080')).toBe(true)
        expect(PortForwardRemotePort.same('http', 'http')).toBe(true)
        expect(PortForwardRemotePort.same(8080, 'http')).toBe(false)
    })

    it('gives no number for a name or a port out of range', () => {
        expect(PortForwardRemotePort.numberOf('http')).toBe(0)
        expect(PortForwardRemotePort.numberOf(70000)).toBe(0)
        expect(PortForwardRemotePort.numberOf('80')).toBe(80)
    })
})

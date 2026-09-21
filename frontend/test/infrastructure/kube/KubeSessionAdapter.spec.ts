import { beforeEach, describe, expect, it, vi } from 'vitest'

const connect = vi.fn()
const disconnect = vi.fn()
const sessions = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/kube', () => ({
    ConnectionService: {
        Connect: (...args: unknown[]) => connect(...args),
        Disconnect: (...args: unknown[]) => disconnect(...args),
        Sessions: () => sessions(),
    },
}))

import { ApiError } from '@/domain/errors/ApiError'
import type { TConnectionSpec } from '@/domain/entities/kubeconfig'
import { KubeSessionAdapter } from '@/infrastructure/kube/KubeSessionAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const adapter = new KubeSessionAdapter({ isAvailable: () => true } as WailsRuntimeService)
const withoutRuntime = new KubeSessionAdapter({ isAvailable: () => false } as WailsRuntimeService)

const spec: TConnectionSpec = {
    server: 'https://prod.example.internal:6443',
    caPem: '-----BEGIN CERTIFICATE-----\nfake-ca\n-----END CERTIFICATE-----\n',
    clientCertPem: '',
    clientKeyPem: '',
    token: 'fake-token',
    username: '',
    password: '',
    insecureSkipTlsVerify: false,
    serverName: '',
    proxyUrl: '',
    timeoutSeconds: 0,
}

const failure = async (action: () => Promise<unknown>): Promise<ApiError> => {
    let caught: unknown
    try {
        await action()
    } catch (err) {
        caught = err
    }
    expect(caught).toBeInstanceOf(ApiError)
    return caught as ApiError
}

describe('KubeSessionAdapter', () => {
    beforeEach(() => {
        connect.mockReset()
        disconnect.mockReset()
        sessions.mockReset()
    })

    it('hands the specification to the Go side and returns the session id', async () => {
        connect.mockResolvedValue({ success: true, sessionId: 'session-1' })

        await expect(adapter.connect(spec)).resolves.toBe('session-1')
        expect(connect.mock.calls[0][0].server).toBe('https://prod.example.internal:6443')
        expect(connect.mock.calls[0][0].token).toBe('fake-token')
    })

    it('raises an ApiError when the connection is refused', async () => {
        connect.mockResolvedValue({ success: false, sessionId: '', error: 'x509: certificate signed by unknown authority' })

        const error = await failure(() => adapter.connect(spec))

        expect(error.message).toBe('Could not connect to the cluster')
        expect(error.details).toContain('x509')
    })

    it('raises an ApiError when the binding call rejects', async () => {
        connect.mockRejectedValue(new Error('binding is gone'))

        const error = await failure(() => adapter.connect(spec))

        expect(error.details).toBe('binding is gone')
    })

    it('says plainly that connecting needs the desktop application', async () => {
        const error = await failure(() => withoutRuntime.connect(spec))

        expect(error.message).toContain('desktop application')
        expect(connect).not.toHaveBeenCalled()
    })

    it('closes a session by id', async () => {
        disconnect.mockResolvedValue({ success: true })

        await adapter.disconnect('session-1')

        expect(disconnect).toHaveBeenCalledWith('session-1')
    })

    it('raises an ApiError when the session cannot be closed', async () => {
        disconnect.mockResolvedValue({ success: false, error: 'unknown session: session-9' })

        const error = await failure(() => adapter.disconnect('session-9'))

        expect(error.details).toContain('unknown session')
    })

    it('lists the open sessions', async () => {
        sessions.mockResolvedValue({
            success: true,
            sessions: [{ id: 'session-1', server: 'https://prod.example.internal:6443', createdAt: '2026-01-01T00:00:00Z' }],
        })

        await expect(adapter.sessions()).resolves.toEqual([
            { id: 'session-1', server: 'https://prod.example.internal:6443', createdAt: '2026-01-01T00:00:00Z' },
        ])
    })

    it('degrades quietly without the Wails runtime for everything but connecting', async () => {
        await expect(withoutRuntime.sessions()).resolves.toEqual([])
        await expect(withoutRuntime.disconnect('session-1')).resolves.toBeUndefined()
        expect(sessions).not.toHaveBeenCalled()
        expect(disconnect).not.toHaveBeenCalled()
    })
})

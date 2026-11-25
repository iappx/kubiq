import { beforeEach, describe, expect, it, vi } from 'vitest'

const retarget = vi.fn()
const checkPort = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/channel', () => ({
    ChannelService: {
        RetargetForward: (...args: unknown[]) => retarget(...args),
        CheckPort: (...args: unknown[]) => checkPort(...args),
    },
    ForwardTargetSpec: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
    PortForwardSpec: class {},
}))

import { ApiError } from '@/domain/errors/ApiError'
import { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

let available = true
const adapter = new KubeForwardAdapter({ isAvailable: () => available } as WailsRuntimeService)

describe('KubeForwardAdapter', () => {
    beforeEach(() => {
        retarget.mockReset()
        checkPort.mockReset()
        available = true
    })

    describe('retargeting', () => {
        it('hands the new path and port to the listener that is already open', async () => {
            retarget.mockResolvedValue({ success: true, error: '' })

            await adapter.retarget('forward-1', { path: '/api/v1/namespaces/payments/pods/api-new/portforward', remotePort: 9090 })

            expect(retarget).toHaveBeenCalledWith({
                forwardId: 'forward-1',
                path: '/api/v1/namespaces/payments/pods/api-new/portforward',
                remotePort: 9090,
            })
        })

        it('turns a refusal into an error the user can read', async () => {
            retarget.mockResolvedValue({ success: false, error: 'unknown forward: forward-1' })

            const attempt = adapter.retarget('forward-1', { path: '/p', remotePort: 9090 })

            await expect(attempt).rejects.toBeInstanceOf(ApiError)
            await expect(attempt).rejects.toThrow(KubeForwardAdapter.unmovable)
        })

        it('refuses without the desktop runtime', async () => {
            available = false

            await expect(adapter.retarget('forward-1', { path: '/p', remotePort: 9090 }))
                .rejects.toThrow(KubeForwardAdapter.unavailable)
            expect(retarget).not.toHaveBeenCalled()
        })
    })

    describe('checking ports', () => {
        it('reports a free port on the default loopback address', async () => {
            checkPort.mockResolvedValue({ available: true, error: '' })

            await expect(adapter.checkPort(9879)).resolves.toEqual({ checked: true, available: true, error: '' })
            expect(checkPort).toHaveBeenCalledWith(KubeForwardAdapter.loopback, 9879)
        })

        it('reports an occupied port and passes an explicit address through', async () => {
            checkPort.mockResolvedValue({ available: false, error: 'address already in use' })

            await expect(adapter.checkPort(9879, '0.0.0.0')).resolves.toEqual({
                checked: true,
                available: false,
                error: 'address already in use',
            })
            expect(checkPort).toHaveBeenCalledWith('0.0.0.0', 9879)
        })

        it('degrades quietly outside the desktop runtime', async () => {
            available = false

            await expect(adapter.checkPort(9879)).resolves.toEqual({ checked: false, available: false, error: '' })
            expect(checkPort).not.toHaveBeenCalled()
        })

        it('degrades quietly when the native check rejects', async () => {
            checkPort.mockRejectedValue(new Error('bridge closed'))

            await expect(adapter.checkPort(9879)).resolves.toEqual({
                checked: false,
                available: false,
                error: 'bridge closed',
            })
        })
    })
})

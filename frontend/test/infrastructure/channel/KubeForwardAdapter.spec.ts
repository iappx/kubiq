import { beforeEach, describe, expect, it, vi } from 'vitest'

const retarget = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/channel', () => ({
    ChannelService: {
        RetargetForward: (...args: unknown[]) => retarget(...args),
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
})

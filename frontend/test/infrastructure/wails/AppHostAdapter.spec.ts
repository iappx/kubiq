import { beforeEach, describe, expect, it, vi } from 'vitest'

const environment = vi.fn()
const quit = vi.fn()

vi.mock('@wailsio/runtime', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    System: { Environment: () => environment() },
    Application: { Quit: () => quit() },
}))

import { AppHostAdapter } from '@/infrastructure/wails/AppHostAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const adapter = new AppHostAdapter(new WailsRuntimeService())

describe('AppHostAdapter', () => {
    beforeEach(() => {
        environment.mockReset()
        quit.mockReset()
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('answers the operating system and architecture the runtime reports', async () => {
        environment.mockResolvedValue({ OS: 'windows', Arch: 'amd64' })

        await expect(adapter.platform()).resolves.toEqual({ os: 'windows', arch: 'amd64' })
    })

    it('answers an unknown platform when the runtime cannot tell', async () => {
        environment.mockRejectedValue(new Error('no bridge'))

        await expect(adapter.platform()).resolves.toEqual(AppHostAdapter.unknownPlatform)
    })

    it('neither asks nor quits outside the desktop application', async () => {
        delete (window as any).chrome

        await expect(adapter.platform()).resolves.toEqual(AppHostAdapter.unknownPlatform)
        await adapter.quit()

        expect(environment).not.toHaveBeenCalled()
        expect(quit).not.toHaveBeenCalled()
    })

    it('quits the application through the runtime', async () => {
        quit.mockResolvedValue(undefined)

        await adapter.quit()

        expect(quit).toHaveBeenCalledOnce()
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const setBackgroundColour = vi.fn()

vi.mock('@wailsio/runtime', async importOriginal => ({
    ...(await importOriginal<Record<string, unknown>>()),
    Window: { SetBackgroundColour: (...args: unknown[]) => setBackgroundColour(...args) },
}))

import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'
import { WindowBackgroundAdapter } from '@/infrastructure/wails/WindowBackgroundAdapter'

const adapter = new WindowBackgroundAdapter(new WailsRuntimeService())

describe('WindowBackgroundAdapter', () => {
    beforeEach(() => {
        setBackgroundColour.mockReset()
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('paints the window in the given colour, fully opaque', async () => {
        setBackgroundColour.mockResolvedValue(undefined)

        await adapter.paint({ red: 21, green: 27, blue: 30 })

        expect(setBackgroundColour).toHaveBeenCalledWith(21, 27, 30, 255)
    })

    it('does nothing outside the desktop application', async () => {
        delete (window as any).chrome

        await adapter.paint({ red: 21, green: 27, blue: 30 })

        expect(setBackgroundColour).not.toHaveBeenCalled()
    })

    it('swallows a runtime that cannot paint, since the page itself is already right', async () => {
        setBackgroundColour.mockRejectedValue(new Error('window gone'))

        await expect(adapter.paint({ red: 0, green: 0, blue: 0 })).resolves.toBeUndefined()
    })
})

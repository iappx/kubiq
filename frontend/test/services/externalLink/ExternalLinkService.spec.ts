import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExternalLinkService } from '@/application/services/externalLink/ExternalLinkService'
import type { HostShellAdapter } from '@/infrastructure/process/HostShellAdapter'

describe('ExternalLinkService', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('opens URLs via HostShellAdapter when desktop runtime is available', async () => {
        const openUri = vi.fn().mockResolvedValue(undefined)
        const host = { isAvailable: true, openUri } as unknown as HostShellAdapter
        const service = new ExternalLinkService(host)

        await service.open('  https://example.com/docs  ')

        expect(openUri).toHaveBeenCalledTimes(1)
        expect(openUri).toHaveBeenCalledWith('https://example.com/docs')
    })

    it('falls back to window.open outside Wails runtime', async () => {
        const openUri = vi.fn().mockResolvedValue(undefined)
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        const host = { isAvailable: false, openUri } as unknown as HostShellAdapter
        const service = new ExternalLinkService(host)

        await service.open('https://example.com')

        expect(openUri).not.toHaveBeenCalled()
        expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    })

    it('ignores blank URLs', async () => {
        const openUri = vi.fn().mockResolvedValue(undefined)
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
        const host = { isAvailable: true, openUri } as unknown as HostShellAdapter
        const service = new ExternalLinkService(host)

        await service.open('   ')

        expect(openUri).not.toHaveBeenCalled()
        expect(openSpy).not.toHaveBeenCalled()
    })
})

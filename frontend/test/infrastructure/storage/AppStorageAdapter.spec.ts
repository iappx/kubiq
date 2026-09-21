import { beforeEach, describe, expect, it, vi } from 'vitest'

const info = vi.fn()
const openDir = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/storage', () => ({
    StorageService: { Info: () => info() },
}))

vi.mock('../../../bindings/iappx_k8s_admin/core/services/io', () => ({
    IoService: { OpenDir: (path: string) => openDir(path) },
}))

import { ApiError } from '@/domain/errors/ApiError'
import { AppStorageAdapter } from '@/infrastructure/storage/AppStorageAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const runtime = (available: boolean) => ({ isAvailable: () => available }) as WailsRuntimeService

const unknown = { root: '', logs: '', version: 0 }

describe('AppStorageAdapter', () => {
    beforeEach(() => {
        info.mockReset()
        openDir.mockReset()
    })

    describe('without a desktop host', () => {
        it('reports no paths instead of calling the binding', async () => {
            await expect(new AppStorageAdapter(runtime(false)).info()).resolves.toEqual(unknown)
            expect(info).not.toHaveBeenCalled()
        })

        it('quietly does nothing when asked to open the log folder', async () => {
            await expect(new AppStorageAdapter(runtime(false)).openLogFolder()).resolves.toBeUndefined()
            expect(openDir).not.toHaveBeenCalled()
        })
    })

    describe('with a desktop host', () => {
        it('reports the folders and the storage format the Go side keeps', async () => {
            info.mockResolvedValue({
                success: true,
                root: 'C:/Users/tester/AppData/Roaming/kubiq',
                logs: 'C:/Users/tester/AppData/Roaming/kubiq/logs',
                version: 1,
                error: '',
            })

            await expect(new AppStorageAdapter(runtime(true)).info()).resolves.toEqual({
                root: 'C:/Users/tester/AppData/Roaming/kubiq',
                logs: 'C:/Users/tester/AppData/Roaming/kubiq/logs',
                version: 1,
            })
        })

        it('reports no paths when the Go side refused, rather than raising', async () => {
            info.mockResolvedValue({ success: false, root: '', logs: '', version: 0, error: 'no profile' })

            await expect(new AppStorageAdapter(runtime(true)).info()).resolves.toEqual(unknown)
        })

        it('reports no paths when the binding call rejects', async () => {
            info.mockRejectedValue(new Error('binding is gone'))

            await expect(new AppStorageAdapter(runtime(true)).info()).resolves.toEqual(unknown)
        })

        it('opens the log folder by its user-profile path, not an absolute one', async () => {
            openDir.mockResolvedValue({ success: true, data: '' })

            await new AppStorageAdapter(runtime(true)).openLogFolder()

            expect(openDir).toHaveBeenCalledWith('userdata:logs')
        })

        it('raises an ApiError the user can read when the folder will not open', async () => {
            openDir.mockResolvedValue({ success: false, data: 'no such folder' })

            const failure = await new AppStorageAdapter(runtime(true)).openLogFolder().catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toBe('Could not open the log folder')
            expect((failure as ApiError).details).toBe('no such folder')
        })

        it('raises an ApiError when the binding call rejects', async () => {
            openDir.mockRejectedValue(new Error('binding is gone'))

            const failure = await new AppStorageAdapter(runtime(true)).openLogFolder().catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).details).toBe('binding is gone')
        })
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const openFile = vi.fn()

vi.mock('@wailsio/runtime', () => ({
    Dialogs: { OpenFile: (options: unknown) => openFile(options) },
}))

import { ApiError } from '@/domain/errors/ApiError'
import { FileDialogAdapter } from '@/infrastructure/wails/FileDialogAdapter'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

const runtime = (available: boolean) => ({ isAvailable: () => available }) as WailsRuntimeService

const request = { title: 'Choose a kubeconfig file', filters: [{ title: 'Kubeconfig files', pattern: '*.yaml' }] }

describe('FileDialogAdapter', () => {
    beforeEach(() => {
        openFile.mockReset()
    })

    describe('without a desktop host', () => {
        it('reports itself unavailable', () => {
            expect(new FileDialogAdapter(runtime(false)).isAvailable).toBe(false)
        })

        it('chooses nothing instead of calling the runtime', async () => {
            await expect(new FileDialogAdapter(runtime(false)).openFile(request)).resolves.toBe('')
            expect(openFile).not.toHaveBeenCalled()
        })
    })

    describe('with a desktop host', () => {
        it('returns the chosen file', async () => {
            openFile.mockResolvedValue('C:/Users/tester/.kube/config')

            await expect(new FileDialogAdapter(runtime(true)).openFile(request))
                .resolves.toBe('C:/Users/tester/.kube/config')
        })

        it('asks for one existing file and shows hidden ones, so ~/.kube is reachable', async () => {
            openFile.mockResolvedValue('')

            await new FileDialogAdapter(runtime(true)).openFile(request)

            expect(openFile).toHaveBeenCalledWith(expect.objectContaining({
                Title: 'Choose a kubeconfig file',
                CanChooseFiles: true,
                CanChooseDirectories: false,
                AllowsMultipleSelection: false,
                ShowHiddenFiles: true,
                Filters: [{ DisplayName: 'Kubeconfig files', Pattern: '*.yaml' }],
            }))
        })

        it('asks for one folder, with hidden ones shown, when a folder is wanted', async () => {
            openFile.mockResolvedValue('/Users/tester/Configs/.kube')

            await expect(new FileDialogAdapter(runtime(true)).openFolder({ title: 'Choose a kubeconfig folder' }))
                .resolves.toBe('/Users/tester/Configs/.kube')

            expect(openFile).toHaveBeenCalledWith(expect.objectContaining({
                CanChooseFiles: false,
                CanChooseDirectories: true,
                ShowHiddenFiles: true,
            }))
        })

        it('passes no filters when the caller named none', async () => {
            openFile.mockResolvedValue('')

            await new FileDialogAdapter(runtime(true)).openFile({ title: 'Choose a file' })

            expect(openFile).toHaveBeenCalledWith(expect.objectContaining({ Filters: [] }))
        })

        it('treats a cancelled dialog as no choice, not a failure', async () => {
            openFile.mockResolvedValue('')

            await expect(new FileDialogAdapter(runtime(true)).openFile(request)).resolves.toBe('')
        })

        it('treats a dialog that returned nothing at all as no choice', async () => {
            openFile.mockResolvedValue(undefined)

            await expect(new FileDialogAdapter(runtime(true)).openFile(request)).resolves.toBe('')
        })

        it('treats a dialog closed by hand as no choice, although Windows reports it as a failure', async () => {
            openFile.mockRejectedValue(
                new Error('Invalid dialog call: Dialog.OpenFile failed, error getting selection: cancelled by user'),
            )

            await expect(new FileDialogAdapter(runtime(true)).openFile(request)).resolves.toBe('')
            await expect(new FileDialogAdapter(runtime(true)).openFolder({ title: 'Choose a folder' })).resolves.toBe('')
        })

        it('raises an ApiError the user can read when the dialog will not open', async () => {
            openFile.mockRejectedValue(new Error('no window'))

            const failure = await new FileDialogAdapter(runtime(true)).openFile(request).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect((failure as ApiError).message).toBe('Could not open the file dialog')
            expect((failure as ApiError).details).toBe('no window')
        })
    })
})

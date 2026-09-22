import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const readFile = vi.fn()
const writeFile = vi.fn()
const removeFile = vi.fn()

vi.mock('../../bindings/iappx_k8s_admin/core/services/io', () => ({
    IoService: {
        ReadFile: (...args: unknown[]) => readFile(...args),
        WriteFile: (...args: unknown[]) => writeFile(...args),
        RemoveFile: (...args: unknown[]) => removeFile(...args),
    },
}))

import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import { ApiError } from '@/domain/errors/ApiError'

const transport = container.resolve(FileSystemTransport)

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

describe('FileSystemTransport', () => {
    beforeEach(() => {
        readFile.mockReset()
        writeFile.mockReset()
        removeFile.mockReset()
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('reads nothing when the Wails runtime is absent', async () => {
        delete (window as any).chrome

        await expect(transport.send({ path: 'data/items.json', operation: 'read' })).resolves.toBeNull()
        expect(readFile).not.toHaveBeenCalled()
    })

    it('returns the file content', async () => {
        readFile.mockResolvedValue({ success: true, data: '[]' })

        await expect(transport.send({ path: 'data/items.json', operation: 'read' })).resolves.toBe('[]')
    })

    it('treats a missing file as no content', async () => {
        readFile.mockResolvedValue({ success: false, data: 'no such file' })

        await expect(transport.send({ path: 'data/items.json', operation: 'read' })).resolves.toBeNull()
    })

    it('raises an ApiError when the binding call rejects', async () => {
        readFile.mockRejectedValue(new Error('binding is gone'))

        const error = await failure(() => transport.send({ path: 'data/items.json', operation: 'read' }))

        expect(error.details).toBe('binding is gone')
    })

    it('raises an ApiError when the write fails', async () => {
        writeFile.mockResolvedValue({ success: false, data: 'disk is full' })

        const error = await failure(
            () => transport.send({ path: 'data/items.json', operation: 'write', content: '[]' }),
        )

        expect(error.message).toBe('Could not save the changes')
        expect(error.details).toBe('disk is full')
    })

    it('passes the content through to the binding', async () => {
        writeFile.mockResolvedValue({ success: true, data: '' })

        await transport.send({ path: 'data/items.json', operation: 'write', content: '[1]' })

        expect(writeFile.mock.calls[0][0]).toBe('data/items.json')
        expect(writeFile.mock.calls[0][1]).toBe('[1]')
    })

    it('deletes the file the caller named', async () => {
        removeFile.mockResolvedValue({ success: true, data: '' })

        await expect(transport.send({ path: 'userdata:kubeconfigs/lab.yaml', operation: 'remove' }))
            .resolves.toBeNull()

        expect(removeFile.mock.calls[0][0]).toBe('userdata:kubeconfigs/lab.yaml')
    })

    it('raises an ApiError when the file will not go', async () => {
        removeFile.mockResolvedValue({ success: false, data: 'file is in use' })

        const error = await failure(
            () => transport.send({ path: 'userdata:kubeconfigs/lab.yaml', operation: 'remove' }),
        )

        expect(error.message).toBe('Could not delete the file')
        expect(error.details).toBe('file is in use')
    })

    it('deletes nothing when the Wails runtime is absent', async () => {
        delete (window as any).chrome

        await transport.send({ path: 'userdata:kubeconfigs/lab.yaml', operation: 'remove' })

        expect(removeFile).not.toHaveBeenCalled()
    })
})

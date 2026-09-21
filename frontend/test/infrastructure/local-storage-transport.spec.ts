import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'
import { LocalStorageTransport } from '@/infrastructure/entityRepo/transport/LocalStorageTransport'
import { ApiError } from '@/domain/errors/ApiError'

const transport = container.resolve(LocalStorageTransport)

describe('LocalStorageTransport', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('reads nothing for an unknown key', async () => {
        await expect(transport.send({ key: 'items', operation: 'read' })).resolves.toBeNull()
    })

    it('reads back what it wrote', async () => {
        await transport.send({ key: 'items', operation: 'write', content: '[1]' })

        await expect(transport.send({ key: 'items', operation: 'read' })).resolves.toBe('[1]')
    })

    it('raises an ApiError when the write is rejected', async () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })

        let caught: unknown
        try {
            await transport.send({ key: 'items', operation: 'write', content: '[]' })
        } catch (err) {
            caught = err
        }

        expect(caught).toBeInstanceOf(ApiError)
        expect((caught as ApiError).details).toBe('QuotaExceededError')
    })
})

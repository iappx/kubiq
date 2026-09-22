import { describe, expect, it } from 'vitest'
import { HelmScopeFanOut } from '@/application/services/helm/models/HelmScopeFanOut'
import { ApiError } from '@/domain/errors/ApiError'

const deferred = () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
        release = resolve
    })

    return { gate, release }
}

describe('HelmScopeFanOut', () => {
    describe('scopes', () => {
        it('collapses an empty selection to the one cluster-wide scope', () => {
            expect(HelmScopeFanOut.scopesOf([])).toEqual([''])
        })

        it('drops blanks and duplicates so a namespace is never read twice', () => {
            expect(HelmScopeFanOut.scopesOf(['dev', ' ', 'dev', ' prod '])).toEqual(['dev', 'prod'])
        })
    })

    it('answers in scope order however the reads finished', async () => {
        const slow = deferred()
        const gathered = new HelmScopeFanOut(['dev', 'prod'], 2, async (namespace) => {
            if (namespace === 'dev') {
                await slow.gate
            }

            return namespace.toUpperCase()
        }).gather()

        slow.release()

        expect(await gathered).toEqual(['DEV', 'PROD'])
    })

    it('keeps no more reads in flight than it was allowed', async () => {
        const scopes = Array.from({ length: 10 }, (unused, index) => `ns-${index}`)
        const held = deferred()
        let running = 0
        let peak = 0

        const gathered = new HelmScopeFanOut(scopes, 3, async (namespace) => {
            running += 1
            peak = Math.max(peak, running)
            await held.gate
            running -= 1

            return namespace
        }).gather()

        await Promise.resolve()
        held.release()
        await gathered

        expect(peak).toBe(3)
    })

    it('names the namespace that failed and stops handing out the rest', async () => {
        const read: string[] = []
        const failure = await new HelmScopeFanOut(['dev', 'prod', 'infra'], 1, async (namespace) => {
            read.push(namespace)
            if (namespace === 'prod') {
                throw new ApiError('Helm did not answer within 30 seconds', 'still running', -3)
            }

            return namespace
        }).gather().catch(err => err) as ApiError

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toBe('Helm did not answer within 30 seconds (namespace "prod")')
        expect(failure.details).toBe('still running')
        expect(failure.status).toBe(-3)
        expect(read).toEqual(['dev', 'prod'])
    })

    it('leaves a cluster-wide failure worded as the transport wrote it', async () => {
        const failure = await new HelmScopeFanOut([''], 6, () => {
            throw new ApiError('Helm did not answer within 30 seconds')
        }).gather().catch(err => err) as ApiError

        expect(failure.message).toBe('Helm did not answer within 30 seconds')
    })

    it('passes a defect of our own through untouched', async () => {
        const failure = await new HelmScopeFanOut(['dev', 'prod'], 6, () => {
            throw new TypeError('read of undefined')
        }).gather().catch(err => err)

        expect(failure).toBeInstanceOf(TypeError)
    })
})

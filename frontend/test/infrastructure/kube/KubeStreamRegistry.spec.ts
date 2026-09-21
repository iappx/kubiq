import { beforeEach, describe, expect, it } from 'vitest'
import { KubeStreamRegistry } from '@/infrastructure/kube/KubeStreamRegistry'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

class RecordingStream implements IClusterStream {
    public stopped = 0

    public stop(): Promise<void> {
        this.stopped++
        return Promise.resolve()
    }
}

class BrokenStream implements IClusterStream {
    public stopped = 0

    public stop(): Promise<void> {
        this.stopped++
        return Promise.reject(new Error('the socket is already gone'))
    }
}

let registry: KubeStreamRegistry

describe('KubeStreamRegistry', () => {
    beforeEach(() => {
        registry = new KubeStreamRegistry()
    })

    it('counts what each cluster has open', () => {
        registry.register('prod', new RecordingStream())
        registry.register('prod', new RecordingStream())
        registry.register('lab', new RecordingStream())

        expect(registry.count('prod')).toBe(2)
        expect(registry.count('lab')).toBe(1)
        expect(registry.count('ghost')).toBe(0)
        expect(registry.total).toBe(3)
    })

    it('hands back a way to forget a stream that ended on its own', () => {
        const stream = new RecordingStream()
        const forget = registry.register('prod', stream)

        forget()

        expect(registry.count('prod')).toBe(0)
    })

    it('registers the same stream once', () => {
        const stream = new RecordingStream()
        registry.register('prod', stream)
        registry.register('prod', stream)

        expect(registry.count('prod')).toBe(1)
    })

    it('stops every stream of one cluster and no other', async () => {
        const first = new RecordingStream()
        const second = new RecordingStream()
        const other = new RecordingStream()
        registry.register('prod', first)
        registry.register('prod', second)
        registry.register('lab', other)

        await expect(registry.drain('prod')).resolves.toBe(2)

        expect(first.stopped).toBe(1)
        expect(second.stopped).toBe(1)
        expect(other.stopped).toBe(0)
        expect(registry.count('prod')).toBe(0)
        expect(registry.count('lab')).toBe(1)
    })

    it('asks every stream to stop even when one of them throws', async () => {
        const broken = new BrokenStream()
        const healthy = new RecordingStream()
        registry.register('prod', broken)
        registry.register('prod', healthy)

        await expect(registry.drain('prod')).resolves.toBe(2)

        expect(broken.stopped).toBe(1)
        expect(healthy.stopped).toBe(1)
        expect(registry.count('prod')).toBe(0)
    })

    it('draining a cluster with nothing open is not an error', async () => {
        await expect(registry.drain('ghost')).resolves.toBe(0)
    })

    it('drains every cluster at once', async () => {
        registry.register('prod', new RecordingStream())
        registry.register('lab', new RecordingStream())

        await expect(registry.drainAll()).resolves.toBe(2)

        expect(registry.total).toBe(0)
    })

    it('forgetting an unknown stream leaves the cluster alone', () => {
        const kept = new RecordingStream()
        registry.register('prod', kept)

        registry.forget('prod', new RecordingStream())
        registry.forget('ghost', kept)

        expect(registry.count('prod')).toBe(1)
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const bus = vi.hoisted(() => ({
    listeners: new Map<string, ((event: unknown) => void)[]>(),
    removed: 0,
}))

vi.mock('@wailsio/runtime', () => ({
    Events: {
        On: (name: string, handler: (event: unknown) => void) => {
            const known = bus.listeners.get(name) ?? []
            known.push(handler)
            bus.listeners.set(name, known)

            return () => {
                bus.removed += 1
                const at = known.indexOf(handler)
                if (at !== -1) {
                    known.splice(at, 1)
                }
            }
        },
    },
}))

import { KubeChannelSubscription } from '@/infrastructure/channel/KubeChannelSubscription'
import type { IKubeChannelHandler } from '@/infrastructure/channel/types/IKubeChannelHandler'
import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

const emit = (name: string, data: unknown): void => {
    [...(bus.listeners.get(name) ?? [])].forEach(handler => handler({ data }))
}

const record = (): { handler: IKubeChannelHandler, data: string[], errors: string[], closes: string[] } => {
    const data: string[] = []
    const errors: string[] = []
    const closes: string[] = []

    return {
        data,
        errors,
        closes,
        handler: {
            onData: (_stream: string, bytes: Uint8Array) => data.push(new TextDecoder().decode(bytes)),
            onError: (details: string) => errors.push(details),
            onClose: (status: TKubeChannelStatus, reason: string) => closes.push(`${status}:${reason}`),
        },
    }
}

describe('KubeChannelSubscription', () => {
    beforeEach(() => {
        bus.listeners.clear()
        bus.removed = 0
    })

    // Open answers after the first frames have already crossed the bridge.
    it('holds what arrives before the channel id is known', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        emit(KubeChannelSubscription.dataEvent, { channelId: 'c1', stream: 'stdout', data: btoa('early') })

        expect(sink.data).toHaveLength(0)

        subscription.attach('c1')

        expect(sink.data).toEqual(['early'])
    })

    it('drops what was held for another channel', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        emit(KubeChannelSubscription.dataEvent, { channelId: 'other', stream: 'stdout', data: btoa('not mine') })
        subscription.attach('c1')

        expect(sink.data).toHaveLength(0)
    })

    it('routes only its own channel once attached', () => {
        const first = record()
        const second = record()
        const one = new KubeChannelSubscription(first.handler)
        const two = new KubeChannelSubscription(second.handler)

        one.listen()
        one.attach('c1')
        two.listen()
        two.attach('c2')

        emit(KubeChannelSubscription.dataEvent, { channelId: 'c1', stream: 'stdout', data: btoa('one') })
        emit(KubeChannelSubscription.dataEvent, { channelId: 'c2', stream: 'stdout', data: btoa('two') })

        expect(first.data).toEqual(['one'])
        expect(second.data).toEqual(['two'])
    })

    it('passes the transport failure and the close through', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        subscription.attach('c1')

        emit(KubeChannelSubscription.errorEvent, { channelId: 'c1', error: 'broken pipe' })
        emit(KubeChannelSubscription.closeEvent, { channelId: 'c1', status: 'error', reason: 'gone' })

        expect(sink.errors).toEqual(['broken pipe'])
        expect(sink.closes).toEqual(['error:gone'])
        expect(subscription.isClosed).toBe(true)
    })

    it('reads an unknown status as a failure', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        subscription.attach('c1')
        emit(KubeChannelSubscription.closeEvent, { channelId: 'c1', status: 'nonsense' })

        expect(sink.closes).toEqual(['error:'])
    })

    it('stops listening once the channel is closed', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        subscription.attach('c1')
        emit(KubeChannelSubscription.closeEvent, { channelId: 'c1', status: 'eof' })

        emit(KubeChannelSubscription.dataEvent, { channelId: 'c1', stream: 'stdout', data: btoa('after') })

        expect(sink.data).toHaveLength(0)
        expect(bus.removed).toBe(3)
    })

    it('releases its listeners when cancelled before it ever attached', () => {
        const sink = record()
        const subscription = new KubeChannelSubscription(sink.handler)

        subscription.listen()
        subscription.cancel()

        emit(KubeChannelSubscription.dataEvent, { channelId: 'c1', stream: 'stdout', data: btoa('after') })

        expect(sink.data).toHaveLength(0)
        expect(bus.removed).toBe(3)
    })
})

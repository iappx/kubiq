import { beforeEach, describe, expect, it } from 'vitest'
import { container } from 'tsyringe'
import { ClusterHealthStore } from '@/store/modules/clusterHealth/ClusterHealthStore'

const store = container.resolve(ClusterHealthStore)

describe('ClusterHealthStore', () => {
    beforeEach(() => {
        store.health = {}
        store.details = {}
        store.online = true
    })

    it('reads a cluster it never heard of as healthy and settled', () => {
        expect(store.healthOf('prod')).toBe('healthy')
        expect(store.isSettled('prod')).toBe(true)
        expect(store.detailOf('prod')).toBe('')
    })

    it('remembers what a cluster reported', () => {
        store.set('prod', 'expired', 'The cluster rejected the credentials.')

        expect(store.healthOf('prod')).toBe('expired')
        expect(store.detailOf('prod')).toBe('The cluster rejected the credentials.')
        expect(store.isSettled('prod')).toBe(false)
        expect(store.needsReconnect('prod')).toBe(true)
    })

    it('offers no reconnect for a cluster that is merely unstable', () => {
        store.set('prod', 'degraded', '')

        expect(store.needsReconnect('prod')).toBe(false)
        expect(store.noticeOf('prod').title).toBe('Cluster unstable')
    })

    it('says no network rather than blaming the cluster when the machine is offline', () => {
        store.set('prod', 'unreachable', '')
        store.setOnline(false)

        expect(store.noticeOf('prod').title).toBe('No network')
        expect(store.isSettled('prod')).toBe(false)
    })

    it('unsettles every cluster the moment the network goes', () => {
        store.setOnline(false)

        expect(store.isSettled('prod')).toBe(false)
        expect(store.isSettled('staging')).toBe(false)
    })

    it('offers no reconnect while there is no network to reconnect over', () => {
        store.set('prod', 'expired', '')
        store.setOnline(false)

        expect(store.noticeOf('prod').title).toBe('No network')
    })

    it('forgets a cluster that went away', () => {
        store.set('prod', 'expired', 'gone')
        store.set('staging', 'degraded', 'slow')

        store.forget('prod')

        expect(store.healthOf('prod')).toBe('healthy')
        expect(store.healthOf('staging')).toBe('degraded')
    })

    it('leaves the map alone when asked to forget what it does not hold', () => {
        const before = store.health

        store.forget('prod')

        expect(store.health).toBe(before)
    })
})

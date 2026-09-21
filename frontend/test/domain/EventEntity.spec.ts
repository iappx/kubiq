import { describe, expect, it } from 'vitest'
import { EventEntity } from '@/domain/entities/cluster'
import { KubeObjectFixtures } from '../support/fixtures/KubeObjectFixtures'

const build = (object: Record<string, any>): EventEntity => EventEntity.build(KubeObjectFixtures.withUid(object))

describe('EventEntity', () => {
    it('reads the payload the API server keeps at the top level', () => {
        const event = build(KubeObjectFixtures.warningEvent())

        expect(event.type).toBe('Warning')
        expect(event.reason).toBe('FailedScheduling')
        expect(event.count).toBe(12)
        expect(event.involvedObjectText).toBe('Pod: queue-0')
    })

    it('prefers lastTimestamp, then eventTime, then the first sighting', () => {
        const withLast = KubeObjectFixtures.warningEvent()
        const withEventTime = KubeObjectFixtures.warningEvent()
        delete withEventTime.lastTimestamp
        withEventTime.eventTime = '2026-09-01T10:17:00Z'
        const withFirstOnly = KubeObjectFixtures.warningEvent()
        delete withFirstOnly.lastTimestamp

        expect(build(withLast).lastSeen).toBe('2026-09-01T10:16:40Z')
        expect(build(withEventTime).lastSeen).toBe('2026-09-01T10:17:00Z')
        expect(build(withFirstOnly).lastSeen).toBe('2026-09-01T10:15:10Z')
    })

    it('flags a warning and leaves a normal event alone', () => {
        const warning = build(KubeObjectFixtures.warningEvent())
        const normal = KubeObjectFixtures.warningEvent()
        normal.type = 'Normal'

        expect(warning.state).toBe('warning')
        expect(warning.isProblematic).toBe(true)
        expect(build(normal).state).toBe('ok')
        expect(build(normal).isProblematic).toBe(false)
    })

    it('has no object text when the reference is missing', () => {
        const source = KubeObjectFixtures.warningEvent()
        delete source.involvedObject

        expect(build(source).involvedObjectText).toBe('')
    })

    it('keeps the synthetic uid out of the manifest', () => {
        const serialized = build(KubeObjectFixtures.warningEvent()).serialize()

        expect(serialized.uid).toBeUndefined()
        expect(serialized.type).toBe('Warning')
        expect(serialized.involvedObject.uid).toBe('99998888-7777-6666-5555-444433332222')
    })
})

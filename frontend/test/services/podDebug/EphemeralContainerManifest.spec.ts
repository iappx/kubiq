import { describe, expect, it } from 'vitest'
import { EphemeralContainerManifest } from '@/application/services/podDebug/models/EphemeralContainerManifest'

describe('EphemeralContainerManifest', () => {
    it('builds a valid DNS-1123 debugger container name under 63 characters', () => {
        expect(EphemeralContainerManifest.nameFor('abc123')).toBe('debugger-abc123')
        expect(EphemeralContainerManifest.nameFor('ABC_123/xyz!')).toBe('debugger-abc-123-xyz')
        expect(EphemeralContainerManifest.nameFor('---')).toBe('debugger-0')

        const longName = EphemeralContainerManifest.nameFor('a'.repeat(100))
        expect(longName.length).toBeLessThanOrEqual(63)
        expect(longName).toMatch(/^debugger-[a-z0-9-]+$/)

        const hyphenBoundary = EphemeralContainerManifest.nameFor(`${'a'.repeat(53)}-tail`)
        expect(hyphenBoundary.endsWith('-')).toBe(false)
        expect(hyphenBoundary.length).toBeLessThanOrEqual(63)
    })

    it('encodes namespace and pod name into patch and pod paths', () => {
        expect(EphemeralContainerManifest.patchPath('payments', 'api-0'))
            .toBe('/api/v1/namespaces/payments/pods/api-0/ephemeralcontainers')
        expect(EphemeralContainerManifest.podPath('payments', 'api-0'))
            .toBe('/api/v1/namespaces/payments/pods/api-0')
    })

    it('builds the strategic-merge-patch document with and without targetContainerName', () => {
        expect(EphemeralContainerManifest.patchDocument('debugger-1', 'docker.io/library/alpine:3.20')).toEqual({
            spec: {
                ephemeralContainers: [{
                    name: 'debugger-1',
                    image: 'docker.io/library/alpine:3.20',
                    stdin: true,
                    tty: true,
                }],
            },
        })

        expect(EphemeralContainerManifest.patchDocument('debugger-1', 'busybox:1.36', 'app')).toEqual({
            spec: {
                ephemeralContainers: [{
                    name: 'debugger-1',
                    image: 'busybox:1.36',
                    stdin: true,
                    tty: true,
                    targetContainerName: 'app',
                }],
            },
        })
    })

    it('reads ephemeral container running, terminated and waiting states from pod status', () => {
        expect(EphemeralContainerManifest.containerState({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-1', state: { running: { startedAt: '2026-10-01T10:00:00Z' } } },
                ],
            },
        }, 'debugger-1')).toBe('running')

        expect(EphemeralContainerManifest.containerState({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-1', state: { terminated: { exitCode: 1, reason: 'Error' } } },
                ],
            },
        }, 'debugger-1')).toBe('terminated')

        expect(EphemeralContainerManifest.containerState({
            status: {
                ephemeralContainerStatuses: [
                    { name: 'debugger-1', state: { waiting: { reason: 'ContainerCreating' } } },
                ],
            },
        }, 'debugger-1')).toBe('waiting')

        expect(EphemeralContainerManifest.containerState({}, 'debugger-1')).toBe('waiting')
    })
})

import { describe, expect, it } from 'vitest'
import { PodLogStreamRequest } from '@/application/services/podLogs/models/PodLogStreamRequest'
import { PodLogOptions } from '@/domain/models/kube'

describe('PodLogStreamRequest', () => {
    it('addresses the log subresource of one pod', () => {
        expect(PodLogStreamRequest.path('payments', 'api-0')).toBe('/api/v1/namespaces/payments/pods/api-0/log')
    })

    it('follows by default and names the container it was given', () => {
        const params = PodLogStreamRequest.params(PodLogOptions.defaults('sidecar'))

        expect(params.container).toBe('sidecar')
        expect(params.follow).toBe(true)
        expect(params.tailLines).toBe(PodLogOptions.defaultTailLines)
        expect(params.previous).toBeUndefined()
        expect(params.timestamps).toBeUndefined()
    })

    it('leaves the container out when the cluster is to pick one', () => {
        expect(PodLogStreamRequest.params(PodLogOptions.defaults()).container).toBeUndefined()
    })

    // The API server rejects a followed read of a terminated container.
    it('asks for the previous container without following it', () => {
        const params = PodLogStreamRequest.params(PodLogOptions.defaults('app', true))

        expect(params.previous).toBe(true)
        expect(params.follow).toBeUndefined()
    })

    it('leaves tailLines out when everything was asked for', () => {
        const params = PodLogStreamRequest.params({ ...PodLogOptions.defaults('app'), tailLines: 0 })

        expect(params.tailLines).toBeUndefined()
    })

    it('sends sinceSeconds when a window was chosen', () => {
        const params = PodLogStreamRequest.params({ ...PodLogOptions.defaults('app'), sinceSeconds: 3600 })

        expect(params.sinceSeconds).toBe(3600)
        expect(params.sinceTime).toBeUndefined()
    })

    // The API server refuses a request carrying both.
    it('prefers an instant over a window when both are set', () => {
        const params = PodLogStreamRequest.params({
            ...PodLogOptions.defaults('app'),
            sinceSeconds: 3600,
            sinceTime: '2026-09-21T10:00:00Z',
        })

        expect(params.sinceTime).toBe('2026-09-21T10:00:00Z')
        expect(params.sinceSeconds).toBeUndefined()
    })

    it('sends timestamps when they were asked for', () => {
        const params = PodLogStreamRequest.params({ ...PodLogOptions.defaults('app'), timestamps: true })

        expect(params.timestamps).toBe(true)
    })

    it('builds the whole request in one call', () => {
        const request = PodLogStreamRequest.build('payments', 'api-0', PodLogOptions.defaults('app'))

        expect(request.path).toBe('/api/v1/namespaces/payments/pods/api-0/log')
        expect(request.params?.container).toBe('app')
    })
})

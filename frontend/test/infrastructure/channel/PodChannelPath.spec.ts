import { describe, expect, it } from 'vitest'
import { PodShellCommand } from '@/domain/models/terminal'
import { PodChannelPath } from '@/infrastructure/channel/PodChannelPath'

const readable = (path: string): string => decodeURIComponent(path)

describe('PodChannelPath', () => {
    it('addresses the pod through the registry, not a hand-written path', () => {
        expect(PodChannelPath.objectPath('payments', 'api-0')).toBe('/api/v1/namespaces/payments/pods/api-0')
    })

    it('repeats the command argument once per word', () => {
        const path = readable(PodChannelPath.exec('payments', 'api-0', 'app', ['/bin/sh', '-c', 'exec bash']))

        expect(path).toContain('command=/bin/sh')
        expect(path).toContain('command=-c')
        expect(path).toContain('command=exec bash')
    })

    it('carries the shell fallback as the command', () => {
        const path = readable(PodChannelPath.exec('payments', 'api-0', 'app', PodShellCommand.argv()))

        expect(path).toContain(`command=${PodShellCommand.script()}`)
    })

    it('leaves the container out when none was chosen', () => {
        expect(readable(PodChannelPath.exec('payments', 'api-0', '', []))).not.toContain('container=')
        expect(readable(PodChannelPath.attach('payments', 'api-0', ''))).not.toContain('container=')
    })

    // stderr alongside a tty is refused by the API server.
    it('asks for stdin, stdout and a tty but never stderr', () => {
        const path = readable(PodChannelPath.attach('kube-system', 'node-shell-1', 'shell'))

        expect(path).toContain('stdin=true')
        expect(path).toContain('stdout=true')
        expect(path).toContain('stderr=false')
        expect(path).toContain('tty=true')
    })

    it('points attach at the attach subresource', () => {
        expect(readable(PodChannelPath.attach('kube-system', 'node-shell-1', 'shell')))
            .toContain('/api/v1/namespaces/kube-system/pods/node-shell-1/attach?')
    })

    it('names the remote port on a port forward', () => {
        expect(readable(PodChannelPath.portForward('payments', 'api-0', 8080)))
            .toBe('/api/v1/namespaces/payments/pods/api-0/portforward?ports=8080')
    })
})

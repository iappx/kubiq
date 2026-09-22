import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const start = vi.fn()
const kill = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/process', () => ({
    ProcessService: {
        Start: (...args: unknown[]) => start(...args),
        Kill: (...args: unknown[]) => kill(...args),
        Write: () => Promise.resolve({ success: true, error: '' }),
        Resize: () => Promise.resolve({ success: true, error: '' }),
        List: () => Promise.resolve({ success: true, processes: [], error: '' }),
        CloseAll: () => Promise.resolve(),
    },
    StartSpec: class {
        constructor(source: Record<string, unknown>) {
            Object.assign(this, source)
        }
    },
}))

import { ApiError } from '@/domain/errors/ApiError'
import { HelmTimeouts } from '@/domain/models/helm/HelmTimeouts'
import { HelmTransport } from '@/infrastructure/entityRepo/helm/transport/HelmTransport'
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'
import { MemoryProcessHost } from '../../support/MemoryProcessHost'

const host = new MemoryProcessHost()
const transport = new HelmTransport(
    { executable: 'C:/tools/helm.exe', contextName: 'staging', kubeconfig: '/a;/b' },
    container.resolve(ProcessAdapter),
)

describe('HelmTransport', () => {
    beforeEach(() => {
        host.reset()
        start.mockReset()
        kill.mockReset()
        start.mockImplementation((spec: any) => host.start(spec))
        kill.mockImplementation((id: string) => host.kill(id))
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('runs the executable the environment names, never a bare helm', async () => {
        host.script({ stdout: '[]' })

        await transport.send({ args: ['list'], json: true })

        expect(host.started[0].command).toBe('C:/tools/helm.exe')
    })

    it('pins every command to the context and the kubeconfig of the open connection', async () => {
        host.script({ stdout: '[]' })

        await transport.send({ args: ['list', '--all-namespaces'], json: true })

        expect(host.lastArgs).toEqual(['list', '--all-namespaces', '--kube-context', 'staging'])
        expect(host.lastEnv).toEqual({ KUBECONFIG: '/a;/b' })
    })

    it('parses json output when the caller asked for json', async () => {
        host.script({ stdout: '[{"name":"web"}]' })

        const answer = await transport.send<unknown>({ args: ['list'], json: true })

        expect(answer).toEqual([{ name: 'web' }])
    })

    it('hands plain output back untouched', async () => {
        host.script({ stdout: 'replicaCount: 2\n' })

        const answer = await transport.send<string>({ args: ['get', 'values', 'web'] })

        expect(answer).toBe('replicaCount: 2\n')
    })

    it('reads empty output as an empty collection, not as a failure', async () => {
        host.script({ stdout: '   ' })

        expect(await transport.send<unknown>({ args: ['repo', 'list'], json: true })).toEqual([])
    })

    it('carries the whole reason helm gave, without rewording it', async () => {
        host.script({
            stderr: 'Error: UPGRADE FAILED: cannot patch "web"\nhelm.go:84: [debug] the object has been modified\n',
            code: 1,
        })

        const failure = await transport.send({ args: ['upgrade', 'web', 'bitnami/nginx'] }).catch(err => err) as ApiError

        expect(failure).toBeInstanceOf(ApiError)
        expect(failure.message).toBe('Error: UPGRADE FAILED: cannot patch "web"')
        expect(failure.details).toContain('helm.go:84: [debug] the object has been modified')
        expect(failure.status).toBe(1)
    })

    it('names the exit code when helm failed without saying anything', async () => {
        host.script({ code: 137 })

        const failure = await transport.send({ args: ['list'] }).catch(err => err) as ApiError

        expect(failure.message).toContain('137')
    })

    it('refuses output that claims to be json and is not', async () => {
        host.script({ stdout: 'not json at all' })

        await expect(transport.send({ args: ['list'], json: true })).rejects.toThrow(ApiError)
    })

    it('names a helm that never answered instead of waiting on it for ever', async () => {
        vi.useFakeTimers()
        host.script({ hold: true })

        const failure = transport.send({ args: ['list', '--output', 'json'], json: true }).catch(err => err)
        await vi.advanceTimersByTimeAsync(HelmTimeouts.readMs)
        const error = await failure as ApiError

        expect(error).toBeInstanceOf(ApiError)
        expect(error.message).toBe(`Helm did not answer within ${HelmTimeouts.seconds(HelmTimeouts.readMs)} seconds`)
        expect(error.status).toBe(ProcessCollector.expiredCode)
        expect(host.killed).toEqual(['process-1'])
        vi.useRealTimers()
    })

    it('names the subcommand without repeating the flag values that followed it', async () => {
        vi.useFakeTimers()
        host.script({ hold: true })

        const failure = transport.send({ args: ['get', 'values', 'web', '--output', 'yaml'] }).catch(err => err)
        await vi.advanceTimersByTimeAsync(HelmTimeouts.readMs)
        const error = await failure as ApiError

        expect(error.details).toContain('"helm get values web"')
        expect(error.details).not.toContain('yaml')
        vi.useRealTimers()
    })

    it('degrades to nothing outside the desktop host instead of throwing', async () => {
        delete (window as any).chrome

        expect(await transport.send({ args: ['list'], json: true })).toBeNull()
        expect(host.started).toHaveLength(0)
    })
})

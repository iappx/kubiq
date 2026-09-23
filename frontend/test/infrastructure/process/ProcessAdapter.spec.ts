import { beforeEach, describe, expect, it, vi } from 'vitest'
import { container } from 'tsyringe'

const start = vi.fn()
const kill = vi.fn()
const launch = vi.fn()

vi.mock('../../../bindings/iappx_k8s_admin/core/services/process', () => ({
    ProcessService: {
        Start: (...args: unknown[]) => start(...args),
        Kill: (...args: unknown[]) => kill(...args),
        Launch: (...args: unknown[]) => launch(...args),
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
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
import { ProcessCollector } from '@/infrastructure/process/ProcessCollector'
import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'
import { MemoryProcessHost } from '../../support/MemoryProcessHost'

const host = new MemoryProcessHost()
const adapter = container.resolve(ProcessAdapter)

const sink = () => {
    const out: string[] = []
    const err: string[] = []
    const exits: number[] = []

    const handler: IProcessSink = {
        onOutput: (text, isError) => (isError ? err : out).push(text),
        onExit: code => exits.push(code),
    }

    return { out, err, exits, handler }
}

describe('ProcessAdapter', () => {
    beforeEach(() => {
        host.reset()
        start.mockReset()
        kill.mockReset()
        start.mockImplementation((spec: any) => host.start(spec))
        kill.mockImplementation((id: string) => host.kill(id))
        ;(window as any).chrome = { webview: { postMessage: () => undefined } }
    })

    it('hands the command, its arguments and its environment to the Go side', async () => {
        host.script({ stdout: 'v3.14.0\n' })

        await adapter.collect({ command: 'helm', args: ['version', '--short'], env: { KUBECONFIG: '/a:/b' } })

        expect(host.started[0].command).toBe('helm')
        expect(host.started[0].args).toEqual(['version', '--short'])
        expect(host.started[0].env).toEqual({ KUBECONFIG: '/a:/b' })
        expect(host.started[0].pty).toBe(false)
    })

    it('collects stdout, stderr and the exit code of a finished process', async () => {
        host.script({ stdout: 'listed\n', stderr: 'a warning\n', code: 0 })

        const outcome = await adapter.collect({ command: 'helm', args: ['list'] })

        expect(outcome).toEqual({ code: 0, stdout: 'listed\n', stderr: 'a warning\n' })
    })

    it('reports the exit code of a failed process instead of throwing', async () => {
        host.script({ stderr: 'Error: release not found\n', code: 1 })

        const outcome = await adapter.collect({ command: 'helm', args: ['status', 'nope'] })

        expect(outcome.code).toBe(1)
        expect(outcome.stderr).toBe('Error: release not found\n')
    })

    it('joins a multi-byte character split across two chunks', async () => {
        host.script({ hold: true })
        const recorder = sink()

        await adapter.start({ command: 'helm', args: ['list'] }, recorder.handler)

        // "ф" is D1 84; the chunk boundary falls between the two bytes.
        host.writeRaw('process-1', '0Q==')
        host.writeRaw('process-1', 'hA==')
        host.exit('process-1', 0)

        expect(recorder.out.join('')).toBe('ф')
        expect(recorder.exits).toEqual([0])
    })

    it('emits exactly one exit even when the process is killed', async () => {
        host.script({ hold: true })
        const recorder = sink()

        const run = await adapter.start({ command: 'helm', args: ['upgrade'] }, recorder.handler)
        await run.kill()
        host.exit('process-1', 0)

        expect(host.killed).toEqual(['process-1'])
        expect(recorder.exits).toHaveLength(1)
    })

    it('turns a refused start into an ApiError naming the command', async () => {
        host.script({ refuse: 'executable file not found' })

        await expect(adapter.collect({ command: 'helm', args: ['list'] }))
            .rejects.toThrow(ApiError)
    })

    it('waits for ever on a process that never exits when no deadline was asked for', async () => {
        vi.useFakeTimers()
        host.script({ hold: true })

        let settled = false
        void adapter.collect({ command: 'helm', args: ['list'] }).then(() => (settled = true))
        await vi.advanceTimersByTimeAsync(600_000)

        expect(settled).toBe(false)
        expect(host.killed).toEqual([])
        vi.useRealTimers()
    })

    it('gives up on a process that outlives its deadline and kills it', async () => {
        vi.useFakeTimers()
        host.script({ hold: true })

        const collected = adapter.collect({ command: 'helm', args: ['list'], timeoutMs: 30_000 })
        await vi.advanceTimersByTimeAsync(30_000)
        const outcome = await collected

        expect(outcome.code).toBe(ProcessCollector.expiredCode)
        expect(host.killed).toEqual(['process-1'])
        vi.useRealTimers()
    })

    it('keeps the real exit code of a process that answered inside its deadline', async () => {
        vi.useFakeTimers()
        host.script({ stdout: 'listed\n', code: 0 })

        const outcome = await adapter.collect({ command: 'helm', args: ['list'], timeoutMs: 30_000 })
        await vi.advanceTimersByTimeAsync(60_000)

        expect(outcome).toEqual({ code: 0, stdout: 'listed\n', stderr: '' })
        expect(host.killed).toEqual([])
        vi.useRealTimers()
    })

    it('answers with an unavailable code outside the desktop host instead of failing', async () => {
        delete (window as any).chrome

        const outcome = await adapter.collect({ command: 'helm', args: ['version'] })

        expect(outcome.code).toBe(ProcessAdapter.unavailableCode)
        expect(host.started).toHaveLength(0)
    })

    describe('launch', () => {
        beforeEach(() => {
            launch.mockReset()
        })

        it('hands the file, its arguments and its directory to the Go side', async () => {
            launch.mockResolvedValue({ success: true, error: '' })

            await adapter.launch({ path: 'userdata:updates/setup.exe', args: ['/S', '/relaunch'] })

            expect(launch.mock.calls[0][0]).toMatchObject({
                path: 'userdata:updates/setup.exe',
                args: ['/S', '/relaunch'],
                dir: '',
            })
        })

        it('raises an ApiError carrying the reason the Go side refused', async () => {
            launch.mockResolvedValue({ success: false, error: 'file does not exist' })

            const failure = await adapter.launch({ path: 'missing.exe', args: [] }).catch(err => err)

            expect(failure).toBeInstanceOf(ApiError)
            expect(failure.details).toBe('file does not exist')
        })

        it('refuses outside the desktop host without calling Go', async () => {
            delete (window as any).chrome

            await expect(adapter.launch({ path: 'setup.exe', args: [] })).rejects.toBeInstanceOf(ApiError)
            expect(launch).not.toHaveBeenCalled()
        })
    })
})

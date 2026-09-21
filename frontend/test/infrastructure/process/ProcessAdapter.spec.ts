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
import { ProcessAdapter } from '@/infrastructure/process/ProcessAdapter'
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

    it('answers with an unavailable code outside the desktop host instead of failing', async () => {
        delete (window as any).chrome

        const outcome = await adapter.collect({ command: 'helm', args: ['version'] })

        expect(outcome.code).toBe(ProcessAdapter.unavailableCode)
        expect(host.started).toHaveLength(0)
    })
})

import { Base64 } from '@/lib/encoding/Base64'
import { ProcessRun } from '@/infrastructure/process/ProcessRun'

export type TScriptedProcess = {
    stdout?: string
    stderr?: string
    code?: number
    hold?: boolean
    refuse?: string
}

export type TStartedSpec = {
    command: string
    args: string[]
    env: Record<string, string>
    dir: string
    pty: boolean
}

export class MemoryProcessHost {
    public readonly started: TStartedSpec[] = []

    public readonly killed: string[] = []

    private readonly scripted: TScriptedProcess[] = []

    private sequence = 0

    public script(run: TScriptedProcess): void {
        this.scripted.push(run)
    }

    public get lastArgs(): string[] {
        return this.started[this.started.length - 1]?.args ?? []
    }

    public get lastEnv(): Record<string, string> {
        return this.started[this.started.length - 1]?.env ?? {}
    }

    public reset(): void {
        this.started.splice(0, this.started.length)
        this.killed.splice(0, this.killed.length)
        this.scripted.splice(0, this.scripted.length)
        this.sequence = 0
    }

    public start(spec: TStartedSpec): Promise<{ success: boolean, processId: string, error: string }> {
        this.started.push({ ...spec, args: [...spec.args], env: { ...spec.env } })

        const run = this.scripted.shift() ?? {}
        if (run.refuse !== undefined) {
            return Promise.resolve({ success: false, processId: '', error: run.refuse })
        }

        const processId = `process-${++this.sequence}`
        this.play(processId, run)

        return Promise.resolve({ success: true, processId, error: '' })
    }

    public kill(processId: string): Promise<{ success: boolean, error: string }> {
        this.killed.push(processId)
        this.exit(processId, ProcessRun.killedCode)

        return Promise.resolve({ success: true, error: '' })
    }

    public write(processId: string, text: string, isError: boolean = false): void {
        MemoryProcessHost.emit(
            isError ? ProcessRun.stderrEvent : ProcessRun.stdoutEvent,
            { processId, data: Base64.stringToB64(text) },
        )
    }

    public writeRaw(processId: string, base64: string, isError: boolean = false): void {
        MemoryProcessHost.emit(
            isError ? ProcessRun.stderrEvent : ProcessRun.stdoutEvent,
            { processId, data: base64 },
        )
    }

    public exit(processId: string, code: number): void {
        MemoryProcessHost.emit(ProcessRun.exitEvent, { processId, code })
    }

    private play(processId: string, run: TScriptedProcess): void {
        if (run.stdout) {
            this.write(processId, run.stdout)
        }
        if (run.stderr) {
            this.write(processId, run.stderr, true)
        }
        if (run.hold !== true) {
            this.exit(processId, run.code ?? 0)
        }
    }

    private static emit(name: string, data: unknown): void {
        (window as any)._wails.dispatchWailsEvent({ name, data })
    }
}

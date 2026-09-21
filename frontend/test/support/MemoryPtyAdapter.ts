import { TerminalBytes } from '@/domain/models/terminal'
import type { IPtyHandler } from '@/infrastructure/process/types/IPtyHandler'
import type { TPtySpec } from '@/infrastructure/process/types/TPtySpec'

export class MemoryPty {
    public readonly writes: Uint8Array[] = []

    public readonly resizes: { cols: number, rows: number }[] = []

    public killed = false

    constructor(
        public readonly id: string,
        public readonly spec: TPtySpec,
        private readonly handler: IPtyHandler,
    ) {}

    public data(text: string): void {
        this.handler.onData('stdout', TerminalBytes.fromText(text))
    }

    public exit(code: number): void {
        this.handler.onExit(code)
    }

    public get written(): string {
        return this.writes.map(chunk => new TextDecoder().decode(chunk)).join('')
    }
}

export class MemoryPtyAdapter {
    public available = true

    public refusal: Error | null = null

    public readonly processes: MemoryPty[] = []

    private sequence = 0

    public get isAvailable(): boolean {
        return this.available
    }

    public async start(spec: TPtySpec, handler: IPtyHandler): Promise<string> {
        if (this.refusal) {
            throw this.refusal
        }

        this.sequence += 1
        const process = new MemoryPty(`process-${this.sequence}`, spec, handler)
        this.processes.push(process)

        return process.id
    }

    public async write(processId: string, data: Uint8Array): Promise<void> {
        this.process(processId)?.writes.push(data)
    }

    public async resize(processId: string, cols: number, rows: number): Promise<void> {
        this.process(processId)?.resizes.push({ cols, rows })
    }

    public async kill(processId: string): Promise<void> {
        const process = this.process(processId)
        if (process) {
            process.killed = true
        }
    }

    public get last(): MemoryPty {
        return this.processes[this.processes.length - 1]
    }

    public reset(): void {
        this.processes.length = 0
        this.refusal = null
        this.available = true
        this.sequence = 0
    }

    private process(processId: string): MemoryPty | undefined {
        return this.processes.find(process => process.id === processId)
    }
}

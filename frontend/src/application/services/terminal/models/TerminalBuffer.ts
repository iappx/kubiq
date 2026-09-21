import { TerminalLimits } from '@/application/services/terminal/constants/TerminalLimits'
import { TerminalBytes } from '@/domain/models/terminal'

export class TerminalBuffer {
    private chunks: Uint8Array[] = []

    private bytes: number = 0

    constructor(private readonly limit: number = TerminalLimits.scrollbackBytes) {}

    public get size(): number {
        return this.bytes
    }

    public append(chunk: Uint8Array): void {
        if (chunk.length === 0) {
            return
        }

        this.chunks.push(chunk)
        this.bytes += chunk.length

        while (this.bytes > this.limit && this.chunks.length > 1) {
            const dropped = this.chunks.shift()
            this.bytes -= dropped ? dropped.length : 0
        }
    }

    public snapshot(): Uint8Array {
        return TerminalBytes.concat(this.chunks)
    }

    public clear(): void {
        this.chunks = []
        this.bytes = 0
    }
}

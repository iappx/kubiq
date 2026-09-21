import { PodLogLimits } from '@/application/services/podLogs/constants/PodLogLimits'

export class PodLogBuffer {
    private readonly lineCap: number

    private readonly charCap: number

    private buffered: string[] = []

    private partial: string = ''

    private chars: number = 0

    private droppedCount: number = 0

    private revisionCount: number = 0

    constructor(lineCap: number = PodLogLimits.lines, charCap: number = PodLogLimits.characters) {
        this.lineCap = lineCap
        this.charCap = charCap
    }

    public get lines(): readonly string[] {
        return this.buffered
    }

    public get size(): number {
        return this.buffered.length
    }

    public get dropped(): number {
        return this.droppedCount
    }

    public get revision(): number {
        return this.revisionCount
    }

    // The cluster sends bytes, not lines, so the tail of one chunk is the head of the next line.
    public append(chunk: string): number {
        if (chunk === '') {
            return 0
        }

        const parts = (this.partial + chunk).split('\n')
        this.partial = parts.pop() ?? ''

        if (parts.length === 0) {
            return 0
        }

        parts.forEach((line) => {
            const text = line.endsWith('\r') ? line.slice(0, -1) : line
            this.buffered.push(text)
            this.chars += text.length + 1
        })

        this.trim()
        this.revisionCount += 1

        return parts.length
    }

    public flush(): void {
        if (this.partial === '') {
            return
        }

        this.buffered.push(this.partial)
        this.chars += this.partial.length + 1
        this.partial = ''
        this.trim()
        this.revisionCount += 1
    }

    public clear(): void {
        this.buffered = []
        this.partial = ''
        this.chars = 0
        this.droppedCount = 0
        this.revisionCount += 1
    }

    public text(): string {
        const all = this.partial === '' ? this.buffered : [...this.buffered, this.partial]

        return all.join('\n')
    }

    private trim(): void {
        let drop = Math.max(0, this.buffered.length - this.lineCap)
        let chars = this.chars

        for (let index = 0; index < drop; index += 1) {
            chars -= this.buffered[index].length + 1
        }

        while (drop < this.buffered.length && chars > this.charCap) {
            chars -= this.buffered[drop].length + 1
            drop += 1
        }

        if (drop === 0) {
            return
        }

        this.buffered.splice(0, drop)
        this.chars = chars
        this.droppedCount += drop
    }
}

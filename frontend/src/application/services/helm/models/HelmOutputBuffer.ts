import { HelmLimits } from '@/application/services/helm/constants/HelmLimits'

export class HelmOutputBuffer {
    private readonly stored: string[] = []

    private partial: string = ''

    private dropped: number = 0

    constructor(private readonly limit: number = HelmLimits.maxOutputLines) {}

    public get lines(): readonly string[] {
        return this.partial === '' ? this.stored : [...this.stored, this.partial]
    }

    public get count(): number {
        return this.stored.length + (this.partial === '' ? 0 : 1)
    }

    public get lost(): number {
        return this.dropped
    }

    public append(text: string): void {
        const parts = (this.partial + text.replace(/\r\n?/g, '\n')).split('\n')
        this.partial = parts.pop() ?? ''
        parts.forEach(line => this.push(line))
        this.trim()
    }

    public flush(): void {
        if (this.partial === '') {
            return
        }

        this.push(this.partial)
        this.partial = ''
        this.trim()
    }

    public text(): string {
        return this.lines.join('\n')
    }

    public clear(): void {
        this.stored.splice(0, this.stored.length)
        this.partial = ''
        this.dropped = 0
    }

    private push(line: string): void {
        this.stored.push(line)
    }

    private trim(): void {
        const excess = this.stored.length - this.limit
        if (excess > 0) {
            this.stored.splice(0, excess)
            this.dropped += excess
        }
    }
}

import { ApiError } from '@/domain/errors/ApiError'

export class HelmScopeFanOut<TResult> {
    private readonly gathered: TResult[] = []

    private next = 0

    private failure: unknown = null

    constructor(
        private readonly scopes: readonly string[],
        private readonly parallel: number,
        private readonly read: (namespace: string) => Promise<TResult>,
    ) {}

    public static scopesOf(namespaces: readonly string[]): string[] {
        const chosen = [...new Set(namespaces.map(name => name.trim()).filter(name => name !== ''))]

        return chosen.length > 0 ? chosen : ['']
    }

    public async gather(): Promise<TResult[]> {
        const workers = Math.max(1, Math.min(this.parallel, this.scopes.length))
        await Promise.all(Array.from({ length: workers }, () => this.drain()))

        if (this.failure !== null) {
            throw this.failure
        }

        return this.gathered
    }

    private async drain(): Promise<void> {
        while (this.failure === null) {
            const index = this.next++
            if (index >= this.scopes.length) {
                return
            }

            try {
                this.gathered[index] = await this.read(this.scopes[index])
            } catch (err) {
                this.failure = this.named(this.scopes[index], err)
            }
        }
    }

    private named(namespace: string, err: unknown): unknown {
        if (this.scopes.length < 2 || !(err instanceof ApiError)) {
            return err
        }

        return new ApiError(`${err.message} (namespace "${namespace}")`, err.details, err.status)
    }
}

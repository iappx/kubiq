import { ITransport } from '@iappx/entity-repo'
import { TFileRequest } from '@/infrastructure/entityRepo/transport/types/TFileRequest'

export class MemoryFileTransport implements ITransport<TFileRequest> {
    public readonly files = new Map<string, string>()

    public writes = 0

    public readonly removed: string[] = []

    public async send<TRes>(params: TFileRequest): Promise<TRes> {
        if (params.operation === 'read') {
            return (this.files.get(params.path) ?? null) as TRes
        }

        if (params.operation === 'remove') {
            this.removed.push(params.path)
            this.files.delete(params.path)
            return null as TRes
        }

        this.writes++
        this.files.set(params.path, params.content ?? '')
        return null as TRes
    }

    public seed(path: string, data: unknown): void {
        this.files.set(path, JSON.stringify(data))
    }

    public read(path: string): any {
        const content = this.files.get(path)
        return content ? JSON.parse(content) : null
    }
}

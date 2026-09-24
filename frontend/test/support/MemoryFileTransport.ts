import { ITransport } from '@iappx/entity-repo'
import type { TFileEntry } from '@/infrastructure/entityRepo/transport/types/TFileEntry'
import { TFileRequest } from '@/infrastructure/entityRepo/transport/types/TFileRequest'

export class MemoryFileTransport implements ITransport<TFileRequest> {
    public readonly files = new Map<string, string>()

    public readonly modified = new Map<string, number>()

    public writes = 0

    public readonly removed: string[] = []

    public async send<TRes>(params: TFileRequest): Promise<TRes> {
        if (params.operation === 'read') {
            return (this.files.get(params.path) ?? null) as TRes
        }

        if (params.operation === 'list') {
            return this.list(params.path) as TRes
        }

        if (params.operation === 'stat') {
            return this.stat(params.path) as TRes
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

    public touch(path: string, at: number): void {
        this.modified.set(path, at)
    }

    private list(folder: string): TFileEntry[] | null {
        const prefix = `${folder}/`
        const names = new Set<string>()

        for (const path of this.files.keys()) {
            if (path.startsWith(prefix)) {
                names.add(path.slice(prefix.length).split('/')[0])
            }
        }

        if (names.size === 0) {
            return null
        }

        return [...names].map(name => this.stat(`${prefix}${name}`) as TFileEntry)
    }

    private stat(path: string): TFileEntry | null {
        const name = path.slice(path.lastIndexOf('/') + 1)
        const content = this.files.get(path)

        if (content !== undefined) {
            return { path, name, isDir: false, size: content.length, modifiedAt: this.modified.get(path) ?? 0 }
        }

        if ([...this.files.keys()].some(file => file.startsWith(`${path}/`))) {
            return { path, name, isDir: true, size: 0, modifiedAt: 0 }
        }

        return null
    }
}

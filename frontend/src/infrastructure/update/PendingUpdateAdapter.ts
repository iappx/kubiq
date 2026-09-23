import { inject, singleton } from 'tsyringe'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'
import type { TPendingUpdate } from '@/infrastructure/update/types/TPendingUpdate'

@singleton()
export class PendingUpdateAdapter {
    public static readonly Folder = 'userdata:updates'

    public static readonly File = `${PendingUpdateAdapter.Folder}/pending.json`

    constructor(
        @inject(FileSystemTransport) private readonly transport: FileSystemTransport,
    ) {}

    public async read(): Promise<TPendingUpdate | null> {
        const content = await this.transport.send<string | null>({
            path: PendingUpdateAdapter.File,
            operation: 'read',
        })

        if (!content) {
            return null
        }

        try {
            const parsed = JSON.parse(content) as Record<string, unknown>

            return typeof parsed.version === 'string' && parsed.version !== ''
                ? { version: parsed.version, installer: typeof parsed.installer === 'string' ? parsed.installer : '' }
                : null
        } catch {
            return null
        }
    }

    public async write(pending: TPendingUpdate): Promise<void> {
        await this.transport.send<null>({
            path: PendingUpdateAdapter.File,
            operation: 'write',
            content: JSON.stringify(pending, null, 2),
        })
    }

    public async clear(): Promise<void> {
        await this.transport.send<null>({ path: PendingUpdateAdapter.File, operation: 'remove' })
    }

    public async removeFile(path: string): Promise<void> {
        if (path === '') {
            return
        }

        await this.transport.send<null>({ path, operation: 'remove' })
    }
}

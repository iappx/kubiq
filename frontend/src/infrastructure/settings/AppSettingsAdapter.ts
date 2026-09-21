import { inject, singleton } from 'tsyringe'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

@singleton()
export class AppSettingsAdapter {
    public static readonly File = 'userdata:settings/app.json'

    constructor(
        @inject(FileSystemTransport) private readonly transport: FileSystemTransport,
    ) {}

    // Unlike a collection, a settings file that will not parse degrades to defaults
    // rather than raising: an unreadable preference must not lock the user out.
    public async read(): Promise<unknown> {
        const content = await this.transport.send<string | null>({
            path: AppSettingsAdapter.File,
            operation: 'read',
        })

        if (!content) {
            return null
        }

        try {
            return JSON.parse(content)
        } catch {
            return null
        }
    }

    public async write(document: Record<string, unknown>): Promise<void> {
        await this.transport.send<null>({
            path: AppSettingsAdapter.File,
            operation: 'write',
            content: JSON.stringify(document, null, 2),
        })
    }
}

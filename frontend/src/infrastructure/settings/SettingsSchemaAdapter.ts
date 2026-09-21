import { inject, singleton } from 'tsyringe'
import { AppSettings } from '@/domain/models/settings/AppSettings'
import { FileSystemTransport } from '@/infrastructure/entityRepo/transport/FileSystemTransport'

@singleton()
export class SettingsSchemaAdapter {
    public static readonly File = 'userdata:settings/schema.json'

    constructor(
        @inject(FileSystemTransport) private readonly transport: FileSystemTransport,
    ) {}

    public async read(): Promise<number> {
        const content = await this.transport.send<string | null>({
            path: SettingsSchemaAdapter.File,
            operation: 'read',
        })

        if (!content) {
            return 0
        }

        try {
            return AppSettings.version(JSON.parse(content))
        } catch {
            return 0
        }
    }

    public async write(version: number): Promise<void> {
        await this.transport.send<null>({
            path: SettingsSchemaAdapter.File,
            operation: 'write',
            content: JSON.stringify({ version }, null, 2),
        })
    }
}

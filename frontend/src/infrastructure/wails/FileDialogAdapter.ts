import { inject, singleton } from 'tsyringe'
import { Dialogs } from '@wailsio/runtime'
import { ApiError } from '@/domain/errors/ApiError'
import type { TOpenFileRequest } from '@/infrastructure/wails/types/TOpenFileRequest'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class FileDialogAdapter {
    public static readonly unopenable: string = 'Could not open the file dialog'

    // On Windows, Wails rejects a dismissed dialog with this error instead of resolving it empty.
    private static readonly cancelled: string = 'cancelled by user'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public openFile(request: TOpenFileRequest): Promise<string> {
        return this.open(request, false)
    }

    public openFolder(request: TOpenFileRequest): Promise<string> {
        return this.open(request, true)
    }

    private async open(request: TOpenFileRequest, folder: boolean): Promise<string> {
        if (!this.isAvailable) {
            return ''
        }

        try {
            const selected = await Dialogs.OpenFile({
                Title: request.title,
                Filters: (request.filters ?? []).map(filter => ({ DisplayName: filter.title, Pattern: filter.pattern })),
                CanChooseFiles: !folder,
                CanChooseDirectories: folder,
                AllowsMultipleSelection: false,
                ShowHiddenFiles: true,
                ResolvesAliases: true,
            })

            return selected ?? ''
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (message.includes(FileDialogAdapter.cancelled)) {
                return ''
            }

            throw new ApiError(FileDialogAdapter.unopenable, message)
        }
    }
}

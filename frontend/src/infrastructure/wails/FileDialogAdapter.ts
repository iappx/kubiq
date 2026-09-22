import { inject, singleton } from 'tsyringe'
import { Dialogs } from '@wailsio/runtime'
import { ApiError } from '@/domain/errors/ApiError'
import type { TOpenFileRequest } from '@/infrastructure/wails/types/TOpenFileRequest'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class FileDialogAdapter {
    public static readonly unopenable: string = 'Could not open the file dialog'

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public get isAvailable(): boolean {
        return this.runtime.isAvailable()
    }

    public async openFile(request: TOpenFileRequest): Promise<string> {
        if (!this.isAvailable) {
            return ''
        }

        try {
            const selected = await Dialogs.OpenFile({
                Title: request.title,
                Filters: (request.filters ?? []).map(filter => ({ DisplayName: filter.title, Pattern: filter.pattern })),
                CanChooseFiles: true,
                CanChooseDirectories: false,
                AllowsMultipleSelection: false,
                ShowHiddenFiles: true,
                ResolvesAliases: true,
            })

            return selected ?? ''
        } catch (err) {
            throw new ApiError(FileDialogAdapter.unopenable, err instanceof Error ? err.message : String(err))
        }
    }
}

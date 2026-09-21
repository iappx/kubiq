import { singleton } from 'tsyringe'
import { ApiError } from '@/domain/errors/ApiError'

@singleton()
export class ClipboardService {
    public static readonly unavailable: string = 'Copying is not available in this window'

    public static readonly refused: string = 'Could not copy to the clipboard'

    public async write(text: string): Promise<void> {
        const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
        if (!clipboard) {
            throw new ApiError(ClipboardService.unavailable, 'The runtime exposes no navigator.clipboard')
        }

        try {
            await clipboard.writeText(text)
        } catch (err) {
            throw new ApiError(ClipboardService.refused, err instanceof Error ? err.message : String(err))
        }
    }
}

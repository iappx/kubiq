import { inject, singleton } from 'tsyringe'
import { Window } from '@wailsio/runtime'
import type { TRgbColor } from '@/infrastructure/theme/types/TRgbColor'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class WindowBackgroundAdapter {
    private static readonly opaque: number = 255

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    // WebView2 fills the window with this colour between unloading a page and painting the next one.
    public async paint(color: TRgbColor): Promise<void> {
        if (!this.runtime.isAvailable()) {
            return
        }

        try {
            await Window.SetBackgroundColour(color.red, color.green, color.blue, WindowBackgroundAdapter.opaque)
        } catch {
            return
        }
    }
}

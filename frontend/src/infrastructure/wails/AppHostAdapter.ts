import { inject, singleton } from 'tsyringe'
import { Application, System } from '@wailsio/runtime'
import type { THostPlatform } from '@/infrastructure/wails/types/THostPlatform'
import { WailsRuntimeService } from '@/infrastructure/wails/WailsRuntimeService'

@singleton()
export class AppHostAdapter {
    public static readonly unknownPlatform: THostPlatform = { os: '', arch: '' }

    constructor(
        @inject(WailsRuntimeService) private readonly runtime: WailsRuntimeService,
    ) {}

    public async platform(): Promise<THostPlatform> {
        if (!this.runtime.isAvailable()) {
            return AppHostAdapter.unknownPlatform
        }

        try {
            const environment = await System.Environment()

            return { os: environment.OS ?? '', arch: environment.Arch ?? '' }
        } catch {
            return AppHostAdapter.unknownPlatform
        }
    }

    public async quit(): Promise<void> {
        if (!this.runtime.isAvailable()) {
            return
        }

        await Application.Quit()
    }
}

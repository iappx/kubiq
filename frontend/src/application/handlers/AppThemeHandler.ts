import { inject, singleton } from 'tsyringe'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppTheme } from '@/domain/models/theme'
import { ThemeChangedEvent } from '@/domain/events/app/ThemeChangedEvent'
import { ThemeAdapter } from '@/infrastructure/theme/ThemeAdapter'
import { WindowBackgroundAdapter } from '@/infrastructure/wails/WindowBackgroundAdapter'
import { AppThemeStore } from '@/store/modules/appTheme/AppThemeStore'

@singleton()
export class AppThemeHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ThemeAdapter) private readonly adapter: ThemeAdapter,
        @inject(AppThemeStore) private readonly themeStore: AppThemeStore,
        @inject(WindowBackgroundAdapter) private readonly windowBackground: WindowBackgroundAdapter,
    ) {
        this.eventBus.registerHandler(ThemeChangedEvent, e => this.apply(e))
        this.restore()
    }

    private restore(): void {
        this.themeStore.setTheme(this.adapter.read() ?? AppTheme.Dark)
    }

    private apply(event: ThemeChangedEvent): void {
        this.adapter.write(event.theme)
        this.adapter.applyToDocument(event.theme)

        const background = this.adapter.documentBackground()
        if (background) {
            void this.windowBackground.paint(background)
        }
    }
}

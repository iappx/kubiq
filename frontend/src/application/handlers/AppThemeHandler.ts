import { inject, singleton } from 'tsyringe'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppTheme } from '@/domain/models/theme'
import { ThemeChangedEvent } from '@/domain/events/app/ThemeChangedEvent'
import { ThemeAdapter } from '@/infrastructure/theme/ThemeAdapter'
import { AppThemeStore } from '@/store/modules/appTheme/AppThemeStore'

@singleton()
export class AppThemeHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(ThemeAdapter) private readonly adapter: ThemeAdapter,
        @inject(AppThemeStore) private readonly themeStore: AppThemeStore,
    ) {
        this.eventBus.registerHandler(ThemeChangedEvent, e => this.apply(e))
        this.restore()
    }

    private restore(): void {
        const stored = this.adapter.read()
        this.themeStore.setTheme(stored ?? (this.adapter.prefersDark() ? AppTheme.Dark : AppTheme.Light))
    }

    private apply(event: ThemeChangedEvent): void {
        this.adapter.write(event.theme)
        this.adapter.applyToDocument(event.theme)
    }
}

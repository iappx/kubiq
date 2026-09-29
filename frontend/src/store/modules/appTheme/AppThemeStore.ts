import { inject } from 'tsyringe'
import { InjectableStore, StoreBase } from '@/lib/vue-store'
import { AppTheme } from '@/domain/models/theme'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { ThemeChangedEvent } from '@/domain/events/app/ThemeChangedEvent'

@InjectableStore
export class AppThemeStore extends StoreBase<AppThemeStore> {
    public appTheme: AppTheme = AppTheme.Dark

    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
    ) {
        super()
    }

    public setTheme(appTheme: AppTheme): void {
        this.appTheme = appTheme
        this.eventBus.emitEvent(new ThemeChangedEvent(appTheme))
    }
}

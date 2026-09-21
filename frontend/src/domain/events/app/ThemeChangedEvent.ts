import { AppTheme } from '@/domain/models/theme'

export class ThemeChangedEvent {
    constructor(
        public readonly theme: AppTheme,
    ) {
    }
}

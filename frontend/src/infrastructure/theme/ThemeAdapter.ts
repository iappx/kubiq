import { injectable } from 'tsyringe'
import { AppTheme } from '@/domain/models/theme'

@injectable()
export class ThemeAdapter {
    private static readonly StorageKey = 'app-theme'

    public read(): AppTheme | null {
        const stored = localStorage.getItem(ThemeAdapter.StorageKey)
        if (stored === AppTheme.Light || stored === AppTheme.Dark) {
            return stored
        }
        return null
    }

    public write(theme: AppTheme): void {
        localStorage.setItem(ThemeAdapter.StorageKey, theme)
    }

    public prefersDark(): boolean {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
    }

    public applyToDocument(theme: AppTheme): void {
        document.documentElement.classList.remove(AppTheme.Light, AppTheme.Dark)
        document.documentElement.classList.add(theme)
    }
}

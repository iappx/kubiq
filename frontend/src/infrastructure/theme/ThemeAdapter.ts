import { injectable } from 'tsyringe'
import { AppTheme } from '@/domain/models/theme'
import type { TRgbColor } from '@/infrastructure/theme/types/TRgbColor'

@injectable()
export class ThemeAdapter {
    // index.html reads this key before the bundle boots to paint the splash; rename both together.
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

    public applyToDocument(theme: AppTheme): void {
        document.documentElement.classList.remove(AppTheme.Light, AppTheme.Dark)
        document.documentElement.classList.add(theme)
    }

    public documentBackground(): TRgbColor | null {
        if (typeof document === 'undefined' || !document.body || typeof getComputedStyle !== 'function') {
            return null
        }

        return ThemeAdapter.parseRgb(getComputedStyle(document.body).backgroundColor)
    }

    private static parseRgb(value: string): TRgbColor | null {
        const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value.trim())
        if (!match) {
            return null
        }

        // A stylesheet that has not applied yet computes to transparent, which is no colour to paint.
        if (match[4] !== undefined && Number.parseFloat(match[4]) === 0) {
            return null
        }

        return {
            red: Math.round(Number(match[1])),
            green: Math.round(Number(match[2])),
            blue: Math.round(Number(match[3])),
        }
    }
}

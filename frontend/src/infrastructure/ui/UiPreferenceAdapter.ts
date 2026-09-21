import { injectable } from 'tsyringe'

@injectable()
export class UiPreferenceAdapter {
    public readText(key: string): string | null {
        if (!UiPreferenceAdapter.isAvailable()) {
            return null
        }

        try {
            return localStorage.getItem(key)
        } catch {
            return null
        }
    }

    public readNumber(key: string): number | null {
        const stored = this.readText(key)
        if (stored === null || stored.trim() === '') {
            return null
        }

        const parsed = Number(stored)

        return Number.isFinite(parsed) ? parsed : null
    }

    public readFlag(key: string): boolean | null {
        const stored = this.readText(key)
        if (stored === 'true') {
            return true
        }

        return stored === 'false' ? false : null
    }

    // Deliberately silent where LocalStorageTransport raises: private mode and a
    // blocked origin cost a preference, and the defaults still work.
    public write(key: string, value: string | number | boolean): void {
        if (!UiPreferenceAdapter.isAvailable()) {
            return
        }

        try {
            localStorage.setItem(key, String(value))
        } catch {
            return
        }
    }

    private static isAvailable(): boolean {
        return typeof localStorage !== 'undefined' && localStorage !== null
    }
}

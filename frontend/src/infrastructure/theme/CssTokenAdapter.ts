import { injectable } from 'tsyringe'

@injectable()
export class CssTokenAdapter {
    public read(names: readonly string[]): Record<string, string> {
        const values: Record<string, string> = {}
        if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
            return values
        }

        const computed = getComputedStyle(document.documentElement)
        names.forEach((name) => {
            const value = computed.getPropertyValue(name).trim()
            if (value !== '') {
                values[name] = value
            }
        })

        return values
    }
}

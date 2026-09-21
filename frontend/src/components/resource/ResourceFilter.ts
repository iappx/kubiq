import type { TResourceFilter } from '@/components/resource/types/TResourceFilter'
import type { TResourceRow } from '@/components/resource/types/TResourceRow'

export class ResourceFilter {
    private static readonly key = '[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?(/[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?)?'

    private static readonly value = '[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?'

    private static readonly equality = new RegExp(`^${ResourceFilter.key}\\s*(!=|==|=)\\s*(${ResourceFilter.value})?$`)

    private static readonly set = new RegExp(`^${ResourceFilter.key}\\s+(in|notin)\\s*\\([^()]*\\)$`)

    private static readonly exists = new RegExp(`^!?${ResourceFilter.key}$`)

    public static parse(query: string): TResourceFilter {
        const trimmed = query.trim()

        return ResourceFilter.isLabelSelector(trimmed)
            ? { text: '', labelSelector: ResourceFilter.normalise(trimmed) }
            : { text: trimmed, labelSelector: '' }
    }

    // A bare word is itself a valid "label exists" selector, so a query only counts as one once something in it cannot be a name.
    public static isLabelSelector(query: string): boolean {
        const requirements = ResourceFilter.split(query)
        if (requirements.length === 0) {
            return false
        }

        let decisive = false
        for (const requirement of requirements) {
            if (ResourceFilter.equality.test(requirement) || ResourceFilter.set.test(requirement)) {
                decisive = true
                continue
            }
            if (ResourceFilter.exists.test(requirement)) {
                decisive = decisive || requirement.startsWith('!')
                continue
            }
            return false
        }

        return decisive
    }

    public static matches(row: TResourceRow, text: string): boolean {
        if (text === '') {
            return true
        }

        return row.name.toLowerCase().includes(text.toLowerCase())
    }

    public static apply(rows: readonly TResourceRow[], text: string): TResourceRow[] {
        return text === '' ? [...rows] : rows.filter(row => ResourceFilter.matches(row, text))
    }

    // A comma separates requirements everywhere except inside the value set of `key in (a, b)`, hence the depth counter.
    private static split(query: string): string[] {
        const requirements: string[] = []
        let current = ''
        let depth = 0

        for (const character of query) {
            if (character === '(') {
                depth++
            }
            if (character === ')') {
                depth = Math.max(depth - 1, 0)
            }
            if (character === ',' && depth === 0) {
                requirements.push(current.trim())
                current = ''
                continue
            }
            current += character
        }

        requirements.push(current.trim())

        return requirements.every(requirement => requirement.length > 0) ? requirements : []
    }

    private static normalise(query: string): string {
        return ResourceFilter.split(query).join(',')
    }
}

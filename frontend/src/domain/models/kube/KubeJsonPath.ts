// additionalPrinterColumns use a narrow slice of JSONPath: a dotted field path
// with optional array indices, such as `.status.conditions[0].status`.
export class KubeJsonPath {
    public static read(source: unknown, jsonPath: string): unknown {
        const segments = KubeJsonPath.parse(jsonPath)
        let current: unknown = source
        for (let i = 0; i < segments.length; i++) {
            if (current === null || current === undefined) {
                return undefined
            }
            current = (current as Record<string, unknown>)[segments[i]]
        }
        return current
    }

    public static parse(jsonPath: string): string[] {
        const trimmed = jsonPath.trim().replace(/^\$/, '').replace(/^\./, '')
        if (trimmed.length === 0) {
            return []
        }
        const segments: string[] = []
        const parts = trimmed.split('.')
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (part.length === 0) {
                continue
            }
            const match = /^([^[\]]*)((?:\[\d+\])*)$/.exec(part)
            if (!match) {
                segments.push(part)
                continue
            }
            if (match[1].length > 0) {
                segments.push(match[1])
            }
            const indices = match[2].match(/\d+/g) ?? []
            for (let j = 0; j < indices.length; j++) {
                segments.push(indices[j])
            }
        }
        return segments
    }
}
